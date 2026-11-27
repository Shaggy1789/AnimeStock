package com.example.springboot.Service;

import com.example.springboot.Models.DetalleVenta;
import com.example.springboot.Models.EstadoVenta;
import com.example.springboot.Models.MetodoPago;
import com.example.springboot.Models.MovimientoCaja;
import com.example.springboot.Models.MovimientoStock;
import com.example.springboot.Models.Producto;
import com.example.springboot.Models.TipoMovimiento;
import com.example.springboot.Models.TipoMovimientoStock;
import com.example.springboot.Models.Venta;
import com.example.springboot.Repository.MovimientoCajaRepository;
import com.example.springboot.Repository.MovimientoStockRepository;
import com.example.springboot.Repository.ProductoRepository;
import com.example.springboot.Repository.VentaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ServiceVentasJPA implements ServiceVentas {

    @Autowired
    private VentaRepository ventaRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private MovimientoCajaRepository movimientoCajaRepository;

    @Autowired
    private MovimientoStockRepository movimientoStockRepository;

    @Override
    public List<Venta> findAll() {
        return ventaRepository.findAll();
    }

    @Override
    public Venta findById(int id) {
        return ventaRepository.findById(id).orElse(null);
    }

    @Override
    public Venta findByNumeroComprobante(String numeroComprobante) {
        return ventaRepository.findByNumeroComprobante(numeroComprobante).orElse(null);
    }

    @Override
    public List<Venta> findByEstado(EstadoVenta estado) {
        return ventaRepository.findByEstado(estado);
    }

    @Override
    public List<Venta> findByMetodoPago(MetodoPago metodoPago) {
        return ventaRepository.findByMetodoPago(metodoPago);
    }

    @Override
    public List<Venta> findByVendidoEnBetween(LocalDateTime desde, LocalDateTime hasta) {
        return ventaRepository.findByVendidoEnBetween(desde, hasta);
    }

    @Override
    @Transactional
    public Venta crearVenta(Venta venta) {
        if (venta == null) {
            throw new RuntimeException();
        }

        if (venta.getVendidoEn() == null) {
            venta.setVendidoEn(LocalDateTime.now());
        }

        
        if (venta.getDetalles() != null) {
            for (DetalleVenta detalle : venta.getDetalles()) {
                Producto producto = productoRepository.findById(detalle.getProducto().getId()).orElse(null);
                if (producto == null) {
                    throw new RuntimeException("Producto inexistente: " + detalle.getProducto().getId());
                }
                if (detalle.getCantidad() > producto.getStock()) {
                    throw new RuntimeException("Stock insuficiente de " + producto.getNombre()
                            + " (disponible: " + producto.getStock() + ")");
                }

                producto.setStock(producto.getStock() - detalle.getCantidad());
                productoRepository.save(producto);

                detalle.setVenta(venta);
                detalle.setProducto(producto);
                if (detalle.getNombreProducto() == null) {
                    detalle.setNombreProducto(producto.getNombre());
                }
            }
        }

        
        if (venta.getNumeroComprobante() == null) {
            venta.setNumeroComprobante(generarNumeroComprobante(venta.getVendidoEn().getYear()));
        }

        Venta guardada = ventaRepository.save(venta);

        
        if (guardada.getDetalles() != null) {
            for (DetalleVenta detalle : guardada.getDetalles()) {
                MovimientoStock movimiento = new MovimientoStock();
                movimiento.setProducto(detalle.getProducto());
                movimiento.setTipo(TipoMovimientoStock.SALIDA);
                movimiento.setCantidad(detalle.getCantidad());
                movimiento.setStockResultante(detalle.getProducto().getStock());
                movimiento.setMotivo("Venta " + guardada.getNumeroComprobante());
                movimiento.setVenta(guardada);
                movimiento.setOcurridoEn(guardada.getVendidoEn());
                movimientoStockRepository.save(movimiento);
            }
        }

        
        if (guardada.getEstado() != EstadoVenta.PENDIENTE && guardada.getEstado() != EstadoVenta.ANULADO) {
            MovimientoCaja movimiento = new MovimientoCaja();
            movimiento.setTipo(TipoMovimiento.INGRESO);
            movimiento.setMonto(guardada.getTotal());
            movimiento.setDescripcion("Venta " + guardada.getNumeroComprobante());
            movimiento.setVenta(guardada);
            movimiento.setOcurridoEn(guardada.getVendidoEn());
            movimientoCajaRepository.save(movimiento);
        }

        return guardada;
    }

    @Override
    @Transactional
    public Venta anularVenta(int id) {
        Venta venta = ventaRepository.findById(id).orElse(null);
        if (venta == null) {
            return null;
        }
        if (venta.getEstado() == EstadoVenta.ANULADO) {
            return venta;
        }

        boolean estabaCobrada = venta.getEstado() != EstadoVenta.PENDIENTE;
        LocalDateTime ahora = LocalDateTime.now();

        
        if (venta.getDetalles() != null) {
            for (DetalleVenta detalle : venta.getDetalles()) {
                Producto producto = productoRepository.findById(detalle.getProducto().getId()).orElse(null);
                if (producto == null) {
                    continue;
                }

                producto.setStock(producto.getStock() + detalle.getCantidad());
                productoRepository.save(producto);

                MovimientoStock movimiento = new MovimientoStock();
                movimiento.setProducto(producto);
                movimiento.setTipo(TipoMovimientoStock.ENTRADA);
                movimiento.setCantidad(detalle.getCantidad());
                movimiento.setStockResultante(producto.getStock());
                movimiento.setMotivo("Anulacion venta " + venta.getNumeroComprobante());
                movimiento.setVenta(venta);
                movimiento.setOcurridoEn(ahora);
                movimientoStockRepository.save(movimiento);
            }
        }

        
        venta.setEstado(EstadoVenta.ANULADO);
        venta.setAnuladoEn(ahora);
        Venta guardada = ventaRepository.save(venta);

        
        if (estabaCobrada) {
            MovimientoCaja movimiento = new MovimientoCaja();
            movimiento.setTipo(TipoMovimiento.EGRESO);
            movimiento.setMonto(venta.getTotal());
            movimiento.setDescripcion("Anulacion venta " + venta.getNumeroComprobante());
            movimiento.setVenta(guardada);
            movimiento.setOcurridoEn(ahora);
            movimientoCajaRepository.save(movimiento);
        }

        return guardada;
    }

    @Override
    @Transactional
    public Venta actualizarVenta(int id, Venta nueva) {
        Venta venta = ventaRepository.findById(id).orElse(null);
        if (venta == null) {
            return null;
        }
        if (venta.getEstado() != EstadoVenta.PENDIENTE) {
            throw new IllegalStateException("Solo se pueden editar ventas pendientes");
        }

        if (venta.getDetalles() == null) {
            venta.setDetalles(new java.util.ArrayList<>());
        }

        
        
        for (DetalleVenta detalle : venta.getDetalles()) {
            Producto producto = productoRepository.findById(detalle.getProducto().getId()).orElse(null);
            if (producto != null) {
                producto.setStock(producto.getStock() + detalle.getCantidad());
                productoRepository.save(producto);
            }
        }

        
        venta.getDetalles().clear();
        if (nueva.getDetalles() != null) {
            for (DetalleVenta detalle : nueva.getDetalles()) {
                Producto producto = productoRepository.findById(detalle.getProducto().getId()).orElse(null);
                if (producto == null) {
                    throw new RuntimeException("Producto inexistente: " + detalle.getProducto().getId());
                }
                if (detalle.getCantidad() > producto.getStock()) {
                    throw new RuntimeException("Stock insuficiente de " + producto.getNombre()
                            + " (disponible: " + producto.getStock() + ")");
                }
                producto.setStock(producto.getStock() - detalle.getCantidad());
                productoRepository.save(producto);

                detalle.setVenta(venta);
                detalle.setProducto(producto);
                if (detalle.getNombreProducto() == null) {
                    detalle.setNombreProducto(producto.getNombre());
                }
                venta.getDetalles().add(detalle);
            }
        }

        
        venta.setSubtotal(nueva.getSubtotal());
        venta.setDescuento(nueva.getDescuento());
        venta.setTotal(nueva.getTotal());
        venta.setMetodoPago(nueva.getMetodoPago());
        venta.setEstado(nueva.getEstado());
        venta.setReferencia(nueva.getReferencia());
        venta.setNotas(nueva.getNotas());
        venta.setMontoRecibido(nueva.getMontoRecibido());
        venta.setVuelto(nueva.getVuelto());
        if (nueva.getVendidoEn() != null) {
            venta.setVendidoEn(nueva.getVendidoEn());
        }
        if (nueva.getEstado() == EstadoVenta.ENVIADO && venta.getEnviadoEn() == null) {
            venta.setEnviadoEn(LocalDateTime.now());
        }

        Venta guardada = ventaRepository.save(venta);

        
        if (guardada.getDetalles() != null) {
            for (DetalleVenta detalle : guardada.getDetalles()) {
                MovimientoStock movimiento = new MovimientoStock();
                movimiento.setProducto(detalle.getProducto());
                movimiento.setTipo(TipoMovimientoStock.SALIDA);
                movimiento.setCantidad(detalle.getCantidad());
                movimiento.setStockResultante(detalle.getProducto().getStock());
                movimiento.setMotivo("Venta " + guardada.getNumeroComprobante());
                movimiento.setVenta(guardada);
                movimiento.setOcurridoEn(LocalDateTime.now());
                movimientoStockRepository.save(movimiento);
            }
        }

        
        if (guardada.getEstado() != EstadoVenta.PENDIENTE && guardada.getEstado() != EstadoVenta.ANULADO) {
            boolean yaTieneIngreso = !movimientoCajaRepository.findByVentaId(guardada.getId()).isEmpty();
            if (!yaTieneIngreso) {
                MovimientoCaja movimiento = new MovimientoCaja();
                movimiento.setTipo(TipoMovimiento.INGRESO);
                movimiento.setMonto(guardada.getTotal());
                movimiento.setDescripcion("Venta " + guardada.getNumeroComprobante());
                movimiento.setVenta(guardada);
                movimiento.setOcurridoEn(LocalDateTime.now());
                movimientoCajaRepository.save(movimiento);
            }
        }

        return guardada;
    }

    @Override
    public Venta save(Venta venta) {
        if (venta == null) {
            throw new RuntimeException();
        }
        return ventaRepository.save(venta);
    }

    @Override
    public Venta update(int id, Venta venta) {
        Venta existente = ventaRepository.findById(id).orElse(null);
        if (existente == null) {
            return null;
        }

        existente.setNumeroComprobante(venta.getNumeroComprobante());
        existente.setSubtotal(venta.getSubtotal());
        existente.setDescuento(venta.getDescuento());
        existente.setTotal(venta.getTotal());
        existente.setMetodoPago(venta.getMetodoPago());
        existente.setEstado(venta.getEstado());
        existente.setReferencia(venta.getReferencia());
        existente.setNotas(venta.getNotas());
        existente.setMontoRecibido(venta.getMontoRecibido());
        existente.setVuelto(venta.getVuelto());
        existente.setVendidoEn(venta.getVendidoEn());
        existente.setEnviadoEn(venta.getEnviadoEn());

        return ventaRepository.save(existente);
    }

    @Override
    public void deleteById(int id) {
        ventaRepository.deleteById(id);
    }

    
    private String generarNumeroComprobante(int anio) {
        LocalDateTime inicio = LocalDateTime.of(anio, 1, 1, 0, 0);
        LocalDateTime fin = LocalDateTime.of(anio + 1, 1, 1, 0, 0);
        long secuencia = ventaRepository.countByVendidoEnBetween(inicio, fin) + 1;
        return "A-" + anio + "-" + String.format("%04d", secuencia);
    }
}
