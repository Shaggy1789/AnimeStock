package com.example.springboot;

import com.example.springboot.DTO.CajaMovimientosResponse;
import com.example.springboot.DTO.CategoriaResponse;
import com.example.springboot.DTO.ClienteRequest;
import com.example.springboot.DTO.ClienteSnapshot;
import com.example.springboot.DTO.DashboardResponse;
import com.example.springboot.DTO.MovimientoCajaRequest;
import com.example.springboot.DTO.MovimientoCajaResponse;
import com.example.springboot.DTO.PaginaResponse;
import com.example.springboot.DTO.ProductoRequest;
import com.example.springboot.DTO.ProductoResponse;
import com.example.springboot.DTO.ReportesResponse;
import com.example.springboot.DTO.VentaItemRequest;
import com.example.springboot.DTO.VentaRequest;
import com.example.springboot.DTO.VentaResponse;
import com.example.springboot.Service.ApiService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;


@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@Transactional
class ApiServiceSmokeTest {

    @Autowired
    private ApiService api;

    @Test
    void flujoCompletoProductoVentaCaja() {
        
        CategoriaResponse cat = api.crearCategoria("TEST_SMOKE_CAT");
        assertNotNull(cat);

        ProductoResponse prod = api.crearProducto(new ProductoRequest(
                null, "Peluchito Smoke", "Anime Test", cat.id(),
                new BigDecimal("100"), new BigDecimal("200"), 10, 2, true));
        assertNotNull(prod);
        assertTrue(prod.sku().startsWith("PLU-"), "SKU generado: " + prod.sku());
        assertEquals(10, prod.stock());
        assertEquals("TEST_SMOKE_CAT", prod.category());

        PaginaResponse<ProductoResponse> lista = api.listarProductos("Smoke", null, false, 24);
        assertEquals(1, lista.totalElements());

        
        VentaResponse venta = api.crearVenta(new VentaRequest(
                null,
                List.of(new VentaItemRequest(prod.id(), 2, new BigDecimal("200"))),
                BigDecimal.ZERO, "efectivo", "pendiente", "TX-1", "nota", null, null));
        assertNotNull(venta.receiptNumber());
        assertEquals(0, venta.total().compareTo(new BigDecimal("400")));
        assertEquals("PENDIENTE", venta.status());
        assertNull(venta.cashMovement(), "una venta pendiente no mueve caja");
        assertEquals(8, api.producto(prod.id()).stock());

        
        VentaResponse editada = api.actualizarVenta(venta.id(), new VentaRequest(
                null,
                List.of(new VentaItemRequest(prod.id(), 3, new BigDecimal("200"))),
                new BigDecimal("50"), "transferencia", "pagado", "TX-2", "editada", null, null));
        assertEquals("PAGADO", editada.status());
        assertEquals(0, editada.total().compareTo(new BigDecimal("550")));
        assertEquals("TRANSFERENCIA", editada.paymentMethod());
        assertNotNull(editada.cashMovement(), "al dejar de estar pendiente entra a caja");
        assertEquals(7, api.producto(prod.id()).stock());

        
        VentaResponse anulada = api.anularVenta(venta.id());
        assertEquals("ANULADO", anulada.status());
        assertNotNull(anulada.cashMovement());
        assertEquals(10, api.producto(prod.id()).stock());

        
        VentaResponse vigente = api.crearVenta(new VentaRequest(
                null,
                List.of(new VentaItemRequest(prod.id(), 1, new BigDecimal("200"))),
                BigDecimal.ZERO, "efectivo", "pagado", null, null, null, null));
        assertEquals("PAGADO", vigente.status());

        
        MovimientoCajaResponse mov = api.crearMovimientoCaja(new MovimientoCajaRequest(
                "ingreso", new BigDecimal("1234"), "Fondo inicial", null));
        assertEquals("INGRESO", mov.type());
        assertEquals(0, mov.amount().compareTo(new BigDecimal("1234")));

        CajaMovimientosResponse caja = api.movimientosCaja(null, null, 50, 0);
        assertTrue(caja.totalElements() >= 3,
                "movimientos: ingreso venta + egreso anulacion + manual = " + caja.totalElements());

        
        DashboardResponse dash = api.dashboard();
        assertEquals(4, dash.kpis().size());
        assertEquals(12, dash.monthlyRevenue().size());
        assertTrue(dash.categorySales().stream()
                .anyMatch(c -> "TEST_SMOKE_CAT".equals(c.label())));
        assertTrue(dash.recentSales().size() >= 1);

        
        PaginaResponse<ClienteSnapshot> clientes = api.listarClientes("");
        assertEquals(0, clientes.totalElements());
        assertTrue(clientes.content().isEmpty());

        assertThrows(IllegalArgumentException.class,
                () -> api.crearCliente(new ClienteRequest("Alguien", null, null)));

        
        ReportesResponse reportes = api.reportes(null, null);
        assertNotNull(reportes.kpis());
        assertEquals(0, reportes.kpis().revenue().compareTo(new BigDecimal("200")),
                "solo la venta PAGADO vigente (200) cuenta; las anuladas y la pendiente no");
        assertEquals(0, reportes.kpis().avgTicket().compareTo(new BigDecimal("200")),
                "ticket promedio = 200 / 1 venta");
        assertEquals(100, reportes.kpis().deltas().revenue().intValue(),
                "sin ventas en el período anterior el delta es 100%");
        assertTrue(reportes.sales().stream()
                .anyMatch(s -> "PAGADO".equals(s.status())));
    }
}
