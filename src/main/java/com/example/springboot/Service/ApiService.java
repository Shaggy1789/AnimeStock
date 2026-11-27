package com.example.springboot.Service;

import com.example.springboot.DTO.CajaMovimientosResponse;
import com.example.springboot.DTO.CategoriaResponse;
import com.example.springboot.DTO.ClienteRequest;
import com.example.springboot.DTO.ClienteSnapshot;
import com.example.springboot.DTO.DashboardResponse;
import com.example.springboot.DTO.Fechas;
import com.example.springboot.DTO.MovimientoCajaResponse;
import com.example.springboot.DTO.MovimientoCajaRequest;
import com.example.springboot.DTO.PaginaResponse;
import com.example.springboot.DTO.ProductoRequest;
import com.example.springboot.DTO.ProductoResponse;
import com.example.springboot.DTO.ReportesResponse;
import com.example.springboot.DTO.VentaItemRequest;
import com.example.springboot.DTO.VentaItemResponse;
import com.example.springboot.DTO.VentaRequest;
import com.example.springboot.DTO.VentaResponse;
import com.example.springboot.Models.Categoria;
import com.example.springboot.Models.DetalleVenta;
import com.example.springboot.Models.EstadoVenta;
import com.example.springboot.Models.Foto;
import com.example.springboot.Models.MetodoPago;
import com.example.springboot.Models.MovimientoCaja;
import com.example.springboot.Models.Producto;
import com.example.springboot.Models.TipoMovimiento;
import com.example.springboot.Models.Venta;
import com.example.springboot.Repository.CategoriaRepository;
import com.example.springboot.Repository.FotoRepository;
import com.example.springboot.Repository.ProductoRepository;
import com.example.springboot.Repository.VentaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;


@Service
@Transactional
public class ApiService {

    private static final Locale LOCALE_AR = Locale.forLanguageTag("es-AR");
    private static final String[] MESES =
            {"Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"};
    private static final String[] COLORES =
            {"#a78bfa", "#c084fc", "#d946ef", "#f0abfc", "#a8d5ba", "#f5cf8b"};
    private static final BigDecimal CERO = BigDecimal.ZERO;

    
    private static final long MAX_FOTO_BYTES = 5L * 1024 * 1024;
    private static final Set<String> TIPOS_FOTO =
            Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

    @Autowired
    private ServiceProductos serviceProductos;

    @Autowired
    private ServiceCategorias serviceCategorias;

    @Autowired
    private ServiceVentas serviceVentas;

    @Autowired
    private ServiceMovimientosCaja serviceMovimientosCaja;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private CategoriaRepository categoriaRepository;

    @Autowired
    private VentaRepository ventaRepository;

    @Autowired
    private FotoRepository fotoRepository;

    

    @Transactional(readOnly = true)
    public PaginaResponse<ProductoResponse> listarProductos(String query, String category,
                                                            boolean inStockOnly, Integer limit) {
        String needle = query == null ? "" : query.trim().toLowerCase();
        List<Producto> filtrados = new ArrayList<>();
        for (Producto p : productoRepository.findAll()) {
            if (category != null && !category.isBlank()) {
                String cat = p.getCategoria() != null ? p.getCategoria().getNombre() : null;
                if (!category.equals(cat)) {
                    continue;
                }
            }
            if (inStockOnly && p.getStock() <= 0) {
                continue;
            }
            if (!needle.isEmpty()) {
                String hay = (texto(p.getNombre()) + " " + texto(p.getAnime()) + " "
                        + (p.getCategoria() != null ? texto(p.getCategoria().getNombre()) : ""))
                        .toLowerCase();
                if (!hay.contains(needle)) {
                    continue;
                }
            }
            filtrados.add(p);
        }

        filtrados.sort(Comparator
                .comparingInt((Producto p) -> p.getStock() > 0 ? 0 : 1)
                .thenComparing(p -> texto(p.getNombre()), String.CASE_INSENSITIVE_ORDER));

        int size = (limit != null && limit > 0) ? limit : 24;
        List<ProductoResponse> content = new ArrayList<>();
        for (int i = 0; i < filtrados.size() && i < size; i++) {
            content.add(toProducto(filtrados.get(i)));
        }
        return PaginaResponse.of(content, 0, size, filtrados.size(), null, null);
    }

    @Transactional(readOnly = true)
    public ProductoResponse producto(int id) {
        Producto p = productoRepository.findById(id).orElse(null);
        return p == null ? null : toProducto(p);
    }

    @Transactional(readOnly = true)
    public Foto fotoPrincipal(int productoId) {
        return fotoRepository.findFirstByProductoIdOrderByEsPrincipalDescOrdenAsc(productoId).orElse(null);
    }

    public ProductoResponse crearProducto(ProductoRequest req) {
        if (req == null || req.nombre() == null || req.nombre().isBlank()) {
            throw new IllegalArgumentException("El nombre es obligatorio");
        }
        Producto p = new Producto();
        p.setSku(blankToNull(req.sku()));
        p.setNombre(req.nombre().trim());
        p.setAnime(req.anime());
        p.setCategoria(req.categoriaId() != null
                ? categoriaRepository.findById(req.categoriaId()).orElse(null) : null);
        p.setCosto(req.costo() != null ? req.costo() : CERO);
        p.setPrecio(req.precio() != null ? req.precio() : CERO);
        p.setStock(req.stock() != null ? req.stock() : 0);
        p.setStockMinimo(req.stockMinimo() != null ? req.stockMinimo() : 0);
        p.setActivo(req.activo() == null || req.activo());
        return toProducto(serviceProductos.save(p));
    }

    public ProductoResponse actualizarProducto(int id, ProductoRequest req) {
        Producto existente = productoRepository.findById(id).orElse(null);
        if (existente == null) {
            return null;
        }
        if (req.sku() != null && !req.sku().isBlank()) {
            existente.setSku(req.sku().trim());
        }
        if (req.nombre() != null && !req.nombre().isBlank()) {
            existente.setNombre(req.nombre().trim());
        }
        if (req.anime() != null) {
            existente.setAnime(req.anime());
        }
        if (req.categoriaId() != null) {
            existente.setCategoria(categoriaRepository.findById(req.categoriaId()).orElse(null));
        }
        if (req.costo() != null) {
            existente.setCosto(req.costo());
        }
        if (req.precio() != null) {
            existente.setPrecio(req.precio());
        }
        if (req.stock() != null) {
            existente.setStock(req.stock());
        }
        if (req.stockMinimo() != null) {
            existente.setStockMinimo(req.stockMinimo());
        }
        if (req.activo() != null) {
            existente.setActivo(req.activo());
        }
        return toProducto(productoRepository.save(existente));
    }

    public boolean borrarProducto(int id) {
        if (!productoRepository.existsById(id)) {
            return false;
        }
        serviceProductos.deleteById(id);
        return true;
    }

    

    
    public ProductoResponse guardarFoto(int productoId, String nombre, String tipo,
                                        long tamanio, byte[] datos) {
        Producto p = productoRepository.findById(productoId).orElse(null);
        if (p == null) {
            return null;
        }
        if (datos == null || datos.length == 0) {
            throw new IllegalArgumentException("El archivo de imagen está vacío");
        }
        if (datos.length > MAX_FOTO_BYTES) {
            throw new IllegalArgumentException("La imagen supera los 5 MB");
        }
        String limpio = normalizarTipoFoto(tipo);
        if (limpio == null) {
            throw new IllegalArgumentException("Formato no soportado. Usá JPG, PNG, WebP o GIF.");
        }

        List<Foto> previas = fotoRepository.findByProductoId(productoId);
        if (!previas.isEmpty()) {
            fotoRepository.deleteAll(previas);
        }

        Foto foto = new Foto();
        foto.setNombre(nombre != null && !nombre.isBlank() ? nombre.trim() : ("producto-" + productoId));
        foto.setTipo(limpio);
        foto.setTamanio(datos.length);
        foto.setDatos(datos);
        foto.setProducto(p);
        foto.setEsPrincipal(true);
        foto.setOrden(0);
        fotoRepository.save(foto);

        return toProducto(p);
    }

    
    public ProductoResponse borrarFoto(int productoId) {
        Producto p = productoRepository.findById(productoId).orElse(null);
        if (p == null) {
            return null;
        }
        List<Foto> fotos = fotoRepository.findByProductoId(productoId);
        if (!fotos.isEmpty()) {
            fotoRepository.deleteAll(fotos);
        }
        return toProducto(p);
    }

    
    private static String normalizarTipoFoto(String tipo) {
        if (tipo == null) {
            return null;
        }
        String limpio = tipo.trim().toLowerCase(Locale.ROOT);
        if ("image/jpg".equals(limpio)) {
            limpio = "image/jpeg";
        }
        return TIPOS_FOTO.contains(limpio) ? limpio : null;
    }

    

    @Transactional(readOnly = true)
    public List<CategoriaResponse> listarCategorias() {
        List<CategoriaResponse> rows = new ArrayList<>();
        for (Categoria c : serviceCategorias.findAll()) {
            rows.add(new CategoriaResponse(c.getId(), c.getNombre()));
        }
        return rows;
    }

    public CategoriaResponse crearCategoria(String nombre) {
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("El nombre es obligatorio");
        }
        Categoria c = new Categoria();
        c.setNombre(nombre.trim());
        Categoria saved = serviceCategorias.save(c);
        return new CategoriaResponse(saved.getId(), saved.getNombre());
    }

    public CategoriaResponse actualizarCategoria(int id, String nombre) {
        if (nombre == null || nombre.isBlank()) {
            throw new IllegalArgumentException("El nombre es obligatorio");
        }
        Categoria c = categoriaRepository.findById(id).orElse(null);
        if (c == null) {
            return null;
        }
        c.setNombre(nombre.trim());
        Categoria saved = categoriaRepository.save(c);
        return new CategoriaResponse(saved.getId(), saved.getNombre());
    }

    public boolean borrarCategoria(int id) {
        if (!categoriaRepository.existsById(id)) {
            return false;
        }
        serviceCategorias.deleteById(id);
        return true;
    }

    

    @Transactional(readOnly = true)
    public PaginaResponse<ClienteSnapshot> listarClientes(String query) {
        return PaginaResponse.of(new ArrayList<>(), 0, 10, 0, null, null);
    }

    
    public ClienteSnapshot crearCliente(ClienteRequest req) {
        throw new IllegalArgumentException(
                "El alta de clientes no esta disponible en esta version: todas las ventas se registran a Consumidor final.");
    }

    

    @Transactional(readOnly = true)
    public PaginaResponse<VentaResponse> listarVentas(Integer limit, Integer offset, String status,
                                                      String payment, String q, String from, String to) {
        LocalDateTime desde = Fechas.parse(from);
        LocalDateTime hasta = Fechas.parse(to);

        boolean sinEstado = status == null || status.isBlank() || status.equalsIgnoreCase("todos");
        EstadoVenta estado = sinEstado ? null : normalizarEstado(status);
        boolean sinPago = payment == null || payment.isBlank() || payment.equalsIgnoreCase("todos");
        MetodoPago pago = sinPago ? null : normalizarPago(payment);
        String needle = q == null ? "" : q.trim().toLowerCase();

        List<Venta> rows = new ArrayList<>();
        for (Venta v : ventaRepository.findAll()) {
            if (estado != null && v.getEstado() != estado) {
                continue;
            }
            if (pago != null && v.getMetodoPago() != pago) {
                continue;
            }
            if (desde != null && (v.getVendidoEn() == null || v.getVendidoEn().isBefore(desde))) {
                continue;
            }
            if (hasta != null && (v.getVendidoEn() == null || v.getVendidoEn().isAfter(hasta))) {
                continue;
            }
            if (!needle.isEmpty() && !coincideTexto(v, needle)) {
                continue;
            }
            rows.add(v);
        }

        rows.sort(Comparator
                .comparing(Venta::getVendidoEn, Comparator.nullsLast(Comparator.naturalOrder()))
                .reversed());

        int size = (limit != null && limit > 0) ? limit : 25;
        int off = (offset != null && offset > 0) ? offset : 0;
        List<VentaResponse> content = new ArrayList<>();
        for (int i = off; i < rows.size() && content.size() < size; i++) {
            content.add(toVenta(rows.get(i), null));
        }
        return PaginaResponse.of(content, size > 0 ? off / size : 0, size, rows.size(), desde, hasta);
    }

    @Transactional(readOnly = true)
    public VentaResponse venta(int id) {
        Venta v = ventaRepository.findById(id).orElse(null);
        return v == null ? null : toVenta(v, null);
    }

    public VentaResponse crearVenta(VentaRequest req) {
        Venta venta = construirVenta(req);
        Venta guardada = serviceVentas.crearVenta(venta);
        MovimientoCaja movimiento = primerMovimiento(serviceMovimientosCaja.findByVentaId(guardada.getId()));
        return toVenta(guardada, movimiento);
    }

    public VentaResponse actualizarVenta(int id, VentaRequest req) {
        Venta nueva = construirVenta(req);
        Venta guardada = serviceVentas.actualizarVenta(id, nueva);
        if (guardada == null) {
            return null;
        }
        MovimientoCaja movimiento = primerMovimiento(serviceMovimientosCaja.findByVentaId(id));
        return toVenta(guardada, movimiento);
    }

    public VentaResponse anularVenta(int id) {
        Venta existente = ventaRepository.findById(id).orElse(null);
        if (existente == null) {
            return null;
        }
        if (existente.getEstado() == EstadoVenta.ANULADO) {
            throw new IllegalStateException("La venta ya estaba anulada");
        }
        Venta guardada = serviceVentas.anularVenta(id);

        MovimientoCaja egreso = null;
        for (MovimientoCaja m : serviceMovimientosCaja.findByVentaId(id)) {
            if (m.getTipo() == TipoMovimiento.EGRESO) {
                egreso = m;
            }
        }
        return toVenta(guardada, egreso);
    }

    

    @Transactional(readOnly = true)
    public CajaMovimientosResponse movimientosCaja(String from, String to, Integer limit, Integer offset) {
        LocalDateTime desde = Fechas.parse(from);
        LocalDateTime hasta = Fechas.parse(to);

        List<MovimientoCaja> rows = new ArrayList<>();
        for (MovimientoCaja m : serviceMovimientosCaja.findAll()) {
            if (desde != null && (m.getOcurridoEn() == null || m.getOcurridoEn().isBefore(desde))) {
                continue;
            }
            if (hasta != null && (m.getOcurridoEn() == null || m.getOcurridoEn().isAfter(hasta))) {
                continue;
            }
            rows.add(m);
        }

        BigDecimal income = CERO;
        BigDecimal expense = CERO;
        for (MovimientoCaja m : rows) {
            if (m.getTipo() == TipoMovimiento.EGRESO) {
                expense = expense.add(nz(m.getMonto()));
            } else {
                income = income.add(nz(m.getMonto()));
            }
        }

        rows.sort(Comparator
                .comparing(MovimientoCaja::getOcurridoEn, Comparator.nullsLast(Comparator.naturalOrder()))
                .reversed());

        int size = (limit != null && limit > 0) ? limit : 50;
        int off = (offset != null && offset > 0) ? offset : 0;
        List<MovimientoCajaResponse> content = new ArrayList<>();
        for (int i = off; i < rows.size() && content.size() < size; i++) {
            content.add(toMovimiento(rows.get(i)));
        }
        int totalPages = Math.max(1, (int) Math.ceil((double) rows.size() / size));
        return new CajaMovimientosResponse(content, size > 0 ? off / size : 0, size, rows.size(), totalPages,
                new CajaMovimientosResponse.Summary(income, expense, income.subtract(expense)), desde, hasta);
    }

    public MovimientoCajaResponse crearMovimientoCaja(MovimientoCajaRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("El movimiento esta vacio");
        }
        String tipoTexto = req.type() == null ? "INGRESO" : req.type().trim().toUpperCase();
        TipoMovimiento tipo = "EGRESO".equals(tipoTexto) ? TipoMovimiento.EGRESO : TipoMovimiento.INGRESO;

        BigDecimal monto = req.amount() == null ? CERO : req.amount().abs();
        if (monto.signum() <= 0) {
            throw new IllegalArgumentException("El monto tiene que ser mayor a cero");
        }
        String descripcion = req.description() == null ? "" : req.description().trim();
        if (descripcion.length() < 3) {
            throw new IllegalArgumentException("Escribi una descripcion de al menos 3 caracteres");
        }

        MovimientoCaja m = new MovimientoCaja();
        m.setTipo(tipo);
        m.setMonto(monto);
        m.setDescripcion(descripcion);
        LocalDateTime ocurrido = Fechas.parse(req.occurredAt());
        m.setOcurridoEn(ocurrido != null ? ocurrido : LocalDateTime.now());
        return toMovimiento(serviceMovimientosCaja.save(m));
    }

    

    @Transactional(readOnly = true)
    public DashboardResponse dashboard() {
        List<Venta> validas = new ArrayList<>();
        for (Venta v : ventaRepository.findAll()) {
            if (v.getEstado() != EstadoVenta.ANULADO) {
                validas.add(v);
            }
        }

        YearMonth esteMes = YearMonth.from(LocalDate.now());
        YearMonth mesPrev = esteMes.minusMonths(1);

        BigDecimal totalMes = CERO;
        BigDecimal totalPrev = CERO;
        int ventasMes = 0;
        int pedidosActivos = 0;
        for (Venta v : validas) {
            YearMonth ym = v.getVendidoEn() != null ? YearMonth.from(v.getVendidoEn()) : null;
            if (esteMes.equals(ym)) {
                totalMes = totalMes.add(nz(v.getTotal()));
                ventasMes++;
            }
            if (mesPrev.equals(ym)) {
                totalPrev = totalPrev.add(nz(v.getTotal()));
            }
            if (v.getEstado() == EstadoVenta.PENDIENTE || v.getEstado() == EstadoVenta.ENVIADO) {
                pedidosActivos++;
            }
        }

        List<Producto> productos = productoRepository.findAll();
        long stockBajo = 0;
        for (Producto p : productos) {
            if (p.getStock() < 3) {
                stockBajo++;
            }
        }

        double growth = totalPrev.signum() > 0
                ? totalMes.subtract(totalPrev).doubleValue() / totalPrev.doubleValue() * 100.0 : 0.0;

        List<DashboardResponse.Kpi> kpis = List.of(
                new DashboardResponse.Kpi("Ventas de este Mes", money(totalMes), "mdi-cart-outline",
                        (growth >= 0 ? "+" : "-") + String.format(LOCALE_AR, "%.1f", Math.abs(growth)) + "%",
                        growth >= 0 ? "positive" : "negative", "#a78bfa",
                        ventasMes + " ventas en el mes"),
                new DashboardResponse.Kpi("Pedidos Activos", String.valueOf(pedidosActivos),
                        "mdi-package-variant-closed", "+0,0%", "neutral", "#f0abfc",
                        "pendientes + enviados"),
                new DashboardResponse.Kpi("Stock Bajo", String.valueOf(stockBajo),
                        "mdi-alert-outline", productos.size() + " productos", "neutral", "#f5cf8b",
                        "con stock < 3"),
                new DashboardResponse.Kpi("Nuevos Clientes", "0", "mdi-account-group-outline",
                        "+0 este mes", "positive", "#a8d5ba", "en la base de clientes")
        );

        
        List<DashboardResponse.Punto> mensual = new ArrayList<>();
        for (int i = 11; i >= 0; i--) {
            YearMonth ym = esteMes.minusMonths(i);
            BigDecimal t = CERO;
            for (Venta v : validas) {
                if (v.getVendidoEn() != null && YearMonth.from(v.getVendidoEn()).equals(ym)) {
                    t = t.add(nz(v.getTotal()));
                }
            }
            mensual.add(new DashboardResponse.Punto(mesLabel(ym), t));
        }

        
        Map<String, Long> porCategoria = new LinkedHashMap<>();
        for (Venta v : validas) {
            if (v.getDetalles() == null) {
                continue;
            }
            for (DetalleVenta d : v.getDetalles()) {
                String cat = (d.getProducto() != null && d.getProducto().getCategoria() != null)
                        ? d.getProducto().getCategoria().getNombre() : "Sin categoria";
                porCategoria.merge(cat, (long) d.getCantidad(), Long::sum);
            }
        }
        List<Map.Entry<String, Long>> cats = new ArrayList<>(porCategoria.entrySet());
        cats.sort(Map.Entry.<String, Long>comparingByValue().reversed());
        List<DashboardResponse.CategoriaPunto> categorySales = new ArrayList<>();
        for (int i = 0; i < cats.size(); i++) {
            categorySales.add(new DashboardResponse.CategoriaPunto(
                    cats.get(i).getKey(), cats.get(i).getValue(), COLORES[i % COLORES.length]));
        }

        
        validas.sort(Comparator
                .comparing(Venta::getVendidoEn, Comparator.nullsLast(Comparator.naturalOrder()))
                .reversed());
        List<DashboardResponse.RecentSale> recientes = new ArrayList<>();
        for (int i = 0; i < validas.size() && i < 5; i++) {
            Venta v = validas.get(i);
            StringBuilder nombres = new StringBuilder();
            int stock = 0;
            if (v.getDetalles() != null) {
                for (DetalleVenta d : v.getDetalles()) {
                    if (nombres.length() > 0) {
                        nombres.append(" + ");
                    }
                    nombres.append(d.getNombreProducto() != null ? d.getNombreProducto() : "Producto");
                    if (d.getProducto() != null) {
                        stock = d.getProducto().getStock();
                    }
                }
            }
            recientes.add(new DashboardResponse.RecentSale(
                    ClienteSnapshot.consumidorFinal().name(),
                    ClienteSnapshot.consumidorFinal().initials(),
                    nombres.toString(),
                    fechaLabel(v.getVendidoEn()),
                    money(v.getTotal()),
                    v.getEstado() != null ? v.getEstado().name().toLowerCase() : "",
                    v.getMetodoPago() != null ? v.getMetodoPago().name().toLowerCase() : "",
                    stock));
        }

        return new DashboardResponse(kpis, mensual, categorySales, recientes);
    }

    

    @Transactional(readOnly = true)
    public ReportesResponse reportes(String from, String to) {
        LocalDateTime desde = Fechas.parse(from);
        LocalDateTime hasta = Fechas.parse(to);
        if (desde == null) {
            desde = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        }
        if (hasta == null) {
            hasta = LocalDate.now().atTime(23, 59, 59);
        }
        if (desde.isAfter(hasta)) {
            LocalDateTime tmp = desde;
            desde = hasta;
            hasta = tmp;
        }

        LocalDateTime prevDesde = desde.minusMonths(1);
        LocalDateTime prevHasta = hasta.minusMonths(1);

        List<Venta> list = new ArrayList<>();
        List<Venta> listPrev = new ArrayList<>();
        for (Venta v : ventaRepository.findAll()) {
            if (v.getEstado() == EstadoVenta.ANULADO) {
                continue;
            }
            if (enRango(v.getVendidoEn(), desde, hasta)) {
                list.add(v);
            }
            if (enRango(v.getVendidoEn(), prevDesde, prevHasta)) {
                listPrev.add(v);
            }
        }
        list.sort(Comparator
                .comparing(Venta::getVendidoEn, Comparator.nullsLast(Comparator.naturalOrder())));
        listPrev.sort(Comparator
                .comparing(Venta::getVendidoEn, Comparator.nullsLast(Comparator.naturalOrder())));

        ResumenReporte cur = resumenVentas(list);
        ResumenReporte prev = resumenVentas(listPrev);

        BigDecimal avgTicket = cur.count > 0
                ? cur.revenue.divide(BigDecimal.valueOf(cur.count), 0, RoundingMode.HALF_UP) : CERO;
        BigDecimal avgPrev = prev.count > 0
                ? prev.revenue.divide(BigDecimal.valueOf(prev.count), 0, RoundingMode.HALF_UP) : CERO;
        BigDecimal margin = cur.revenue.signum() > 0 ? porMil(cur.profit, cur.revenue) : CERO;
        BigDecimal marginPrev = prev.revenue.signum() > 0 ? porMil(prev.profit, prev.revenue) : CERO;

        List<VentaResponse> ventas = new ArrayList<>();
        for (Venta v : list) {
            ventas.add(toVenta(v, null));
        }

        return new ReportesResponse(
                desde.toLocalDate().toString(),
                hasta.toLocalDate().toString(),
                new ReportesResponse.KpisReporte(
                        cur.revenue,
                        cur.profit,
                        avgTicket,
                        margin,
                        new ReportesResponse.DeltasReporte(
                                deltaPct(cur.revenue, prev.revenue),
                                deltaPct(cur.profit, prev.profit),
                                deltaPct(avgTicket, avgPrev),
                                deltaPct(margin, marginPrev))),
                ventas);
    }

    private record ResumenReporte(BigDecimal revenue, BigDecimal profit, int count) {
    }

    
    private ResumenReporte resumenVentas(List<Venta> ventas) {
        BigDecimal revenue = CERO;
        BigDecimal profit = CERO;
        int count = 0;
        for (Venta v : ventas) {
            if (v.getEstado() == EstadoVenta.PENDIENTE) {
                continue;
            }
            revenue = revenue.add(nz(v.getTotal()));
            count++;
            if (v.getDetalles() != null) {
                for (DetalleVenta d : v.getDetalles()) {
                    BigDecimal unitario = nz(d.getPrecioUnitario());
                    BigDecimal costo = d.getProducto() != null ? nz(d.getProducto().getCosto()) : CERO;
                    profit = profit.add(unitario.subtract(costo)
                            .multiply(BigDecimal.valueOf(d.getCantidad())));
                }
            }
        }
        return new ResumenReporte(revenue, profit, count);
    }

    private static boolean enRango(LocalDateTime fecha, LocalDateTime desde, LocalDateTime hasta) {
        return fecha != null && !fecha.isBefore(desde) && !fecha.isAfter(hasta);
    }

    
    private static BigDecimal porMil(BigDecimal a, BigDecimal b) {
        if (b.signum() == 0) {
            return CERO;
        }
        return a.divide(b, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
    }

    
    private static BigDecimal deltaPct(BigDecimal a, BigDecimal b) {
        if (b.signum() == 0) {
            return a.signum() == 0 ? CERO : BigDecimal.valueOf(100);
        }
        return a.subtract(b).divide(b, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
    }

    

    private ProductoResponse toProducto(Producto p) {
        String imageUrl = null;
        Foto foto = fotoRepository.findFirstByProductoIdOrderByEsPrincipalDescOrdenAsc(p.getId()).orElse(null);
        if (foto != null) {
            
            imageUrl = "/api/products/" + p.getId() + "/image?v=" + foto.getId();
        }
        return new ProductoResponse(
                p.getId(),
                p.getSku(),
                p.getNombre(),
                p.getAnime(),
                p.getCategoria() != null ? p.getCategoria().getNombre() : null,
                null,
                p.getCosto(),
                p.getPrecio(),
                p.getStock(),
                p.getStockMinimo(),
                p.isActivo(),
                imageUrl);
    }

    private VentaResponse toVenta(Venta v, MovimientoCaja movimiento) {
        List<VentaItemResponse> items = new ArrayList<>();
        if (v.getDetalles() != null) {
            for (DetalleVenta d : v.getDetalles()) {
                Producto p = d.getProducto();
                items.add(new VentaItemResponse(
                        p != null ? p.getId() : null,
                        d.getNombreProducto(),
                        p != null ? p.getAnime() : null,
                        null,
                        d.getCantidad(),
                        d.getPrecioUnitario(),
                        d.getSubtotal()));
            }
        }

        BigDecimal recibido = v.getMontoRecibido() != null ? v.getMontoRecibido() : v.getTotal();
        BigDecimal vuelto = v.getVuelto();
        if (vuelto == null) {
            vuelto = (recibido != null && v.getTotal() != null)
                    ? recibido.subtract(v.getTotal()) : CERO;
        }

        return new VentaResponse(
                v.getId(),
                v.getNumeroComprobante(),
                null,
                ClienteSnapshot.consumidorFinal(),
                items,
                v.getSubtotal(),
                v.getDescuento(),
                v.getTotal(),
                v.getMetodoPago() != null ? v.getMetodoPago().name() : null,
                v.getEstado() != null ? v.getEstado().name() : null,
                v.getReferencia(),
                v.getNotas(),
                recibido,
                vuelto,
                v.getVendidoEn(),
                v.getEnviadoEn(),
                v.getAnuladoEn(),
                movimiento != null ? toMovimiento(movimiento) : null);
    }

    private MovimientoCajaResponse toMovimiento(MovimientoCaja m) {
        Venta venta = m.getVenta();
        return new MovimientoCajaResponse(
                m.getId(),
                m.getTipo() != null ? m.getTipo().name() : null,
                m.getMonto(),
                m.getDescripcion(),
                venta != null ? venta.getId() : null,
                m.getOcurridoEn(),
                venta != null ? venta.getNumeroComprobante() : null,
                venta != null ? ClienteSnapshot.consumidorFinal().name() : null);
    }

    

    private Venta construirVenta(VentaRequest req) {
        if (req == null || req.items() == null || req.items().isEmpty()) {
            throw new IllegalArgumentException("El carrito esta vacio");
        }

        List<DetalleVenta> detalles = new ArrayList<>();
        BigDecimal subtotal = CERO;

        for (VentaItemRequest it : req.items()) {
            if (it == null || it.productId() == null) {
                throw new IllegalArgumentException("Item de venta invalido");
            }
            Producto p = productoRepository.findById(it.productId()).orElse(null);
            if (p == null) {
                throw new IllegalArgumentException("Producto inexistente: " + it.productId());
            }
            int cantidad = it.quantity() != null ? Math.max(1, it.quantity()) : 1;
            if (cantidad > p.getStock()) {
                throw new IllegalArgumentException("Stock insuficiente de " + p.getNombre()
                        + " (disponible: " + p.getStock() + ")");
            }
            BigDecimal unitario = (it.unitPrice() != null && it.unitPrice().signum() > 0)
                    ? it.unitPrice()
                    : (p.getPrecio() != null ? p.getPrecio() : CERO);
            BigDecimal sub = unitario.multiply(BigDecimal.valueOf(cantidad));

            DetalleVenta d = new DetalleVenta();
            d.setProducto(p);
            d.setNombreProducto(p.getNombre());
            d.setCantidad(cantidad);
            d.setPrecioUnitario(unitario);
            d.setSubtotal(sub);

            detalles.add(d);
            subtotal = subtotal.add(sub);
        }

        BigDecimal descuento = req.discount() != null ? req.discount() : CERO;
        if (descuento.signum() < 0) {
            descuento = CERO;
        }
        if (descuento.compareTo(subtotal) > 0) {
            descuento = subtotal;
        }
        BigDecimal total = subtotal.subtract(descuento);
        if (total.signum() < 0) {
            total = CERO;
        }

        EstadoVenta estado = normalizarEstado(req.status());
        MetodoPago pago = normalizarPago(req.paymentMethod());

        BigDecimal recibido;
        if (pago == MetodoPago.EFECTIVO) {
            recibido = req.amountReceived() != null ? req.amountReceived().max(total) : total;
        } else {
            recibido = total;
        }
        BigDecimal vuelto = recibido.subtract(total);

        Venta venta = new Venta();
        venta.setDetalles(detalles);
        venta.setSubtotal(subtotal);
        venta.setDescuento(descuento);
        venta.setTotal(total);
        venta.setMetodoPago(pago);
        venta.setEstado(estado);
        venta.setReferencia(trim(req.reference()));
        venta.setNotas(recortar(trim(req.notes()), 200));
        venta.setMontoRecibido(recibido);
        venta.setVuelto(vuelto);
        LocalDateTime vendido = Fechas.parse(req.soldAt());
        venta.setVendidoEn(vendido != null ? vendido : LocalDateTime.now());
        if (estado == EstadoVenta.ENVIADO) {
            venta.setEnviadoEn(LocalDateTime.now());
        }
        return venta;
    }

    private EstadoVenta normalizarEstado(String valor) {
        String key = valor == null ? "" : valor.trim().toUpperCase();
        switch (key) {
            case "PAGADO":
            case "PAGADA":
            case "COBRADO":
            case "COMPLETADO":
                return EstadoVenta.PAGADO;
            case "ENVIADO":
            case "ENVIO":
            case "ENTREGADO":
                return EstadoVenta.ENVIADO;
            case "ANULADO":
            case "ANULADA":
            case "CANCELADO":
                return EstadoVenta.ANULADO;
            default:
                return EstadoVenta.PENDIENTE;
        }
    }

    private MetodoPago normalizarPago(String valor) {
        String key = valor == null ? "" : valor.trim().toLowerCase().replaceAll("[^a-z]", "");
        switch (key) {
            case "efectivo":
                return MetodoPago.EFECTIVO;
            case "transferencia":
            case "transfer":
                return MetodoPago.TRANSFERENCIA;
            case "mercadopago":
            case "mp":
                return MetodoPago.MERCADOPAGO;
            case "paypal":
            case "pp":
                return MetodoPago.PAYPAL;
            default:
                return MetodoPago.OTRO;
        }
    }

    private boolean coincideTexto(Venta v, String needle) {
        StringBuilder sb = new StringBuilder();
        sb.append(texto(v.getNumeroComprobante())).append(' ');
        sb.append(ClienteSnapshot.consumidorFinal().name()).append(' ');
        if (v.getDetalles() != null) {
            for (DetalleVenta d : v.getDetalles()) {
                sb.append(texto(d.getNombreProducto())).append(' ');
                if (d.getProducto() != null) {
                    sb.append(texto(d.getProducto().getAnime())).append(' ');
                }
            }
        }
        return sb.toString().toLowerCase().contains(needle);
    }

    

    private static MovimientoCaja primerMovimiento(List<MovimientoCaja> lista) {
        return (lista == null || lista.isEmpty()) ? null : lista.get(0);
    }

    private static String texto(String valor) {
        return valor == null ? "" : valor;
    }

    private static String trim(String valor) {
        return valor == null ? "" : valor.trim();
    }

    private static String recortar(String valor, int max) {
        return valor.length() <= max ? valor : valor.substring(0, max);
    }

    private static String blankToNull(String valor) {
        return (valor == null || valor.isBlank()) ? null : valor.trim();
    }

    private static BigDecimal nz(BigDecimal valor) {
        return valor == null ? CERO : valor;
    }

    private static String money(BigDecimal valor) {
        NumberFormat nf = NumberFormat.getNumberInstance(LOCALE_AR);
        nf.setMaximumFractionDigits(0);
        nf.setMinimumFractionDigits(0);
        return "$" + nf.format(valor == null ? CERO : valor);
    }

    private static String mesLabel(YearMonth ym) {
        return MESES[ym.getMonthValue() - 1];
    }

    private static String fechaLabel(LocalDateTime dt) {
        if (dt == null) {
            return "";
        }
        return String.format("%02d %s %d", dt.getDayOfMonth(), MESES[dt.getMonthValue() - 1], dt.getYear());
    }
}
