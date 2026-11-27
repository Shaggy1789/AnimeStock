package com.example.springboot.Controller;

import com.example.springboot.DTO.PaginaResponse;
import com.example.springboot.DTO.VentaRequest;
import com.example.springboot.DTO.VentaResponse;
import com.example.springboot.Service.ApiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/api/sales")
public class VentaController {

    @Autowired
    private ApiService api;

    @GetMapping
    public PaginaResponse<VentaResponse> listar(
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestParam(value = "offset", required = false) Integer offset,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "payment", required = false) String payment,
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "from", required = false) String from,
            @RequestParam(value = "to", required = false) String to) {
        return api.listarVentas(limit, offset, status, payment, q, from, to);
    }

    @GetMapping("/{id}")
    public ResponseEntity<VentaResponse> obtener(@PathVariable int id) {
        VentaResponse v = api.venta(id);
        return v == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(v);
    }

    @PostMapping
    public VentaResponse crear(@RequestBody VentaRequest req) {
        return api.crearVenta(req);
    }

    @PutMapping("/{id}")
    public ResponseEntity<VentaResponse> actualizar(@PathVariable int id, @RequestBody VentaRequest req) {
        VentaResponse v = api.actualizarVenta(id, req);
        return v == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(v);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<VentaResponse> anular(@PathVariable int id) {
        VentaResponse v = api.anularVenta(id);
        return v == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(v);
    }
}
