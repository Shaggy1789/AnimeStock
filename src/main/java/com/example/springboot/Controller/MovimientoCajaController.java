package com.example.springboot.Controller;

import com.example.springboot.DTO.CajaMovimientosResponse;
import com.example.springboot.DTO.MovimientoCajaRequest;
import com.example.springboot.DTO.MovimientoCajaResponse;
import com.example.springboot.Service.ApiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/api/cash")
public class MovimientoCajaController {

    @Autowired
    private ApiService api;

    @GetMapping("/movements")
    public CajaMovimientosResponse movimientos(
            @RequestParam(value = "from", required = false) String from,
            @RequestParam(value = "to", required = false) String to,
            @RequestParam(value = "limit", required = false) Integer limit,
            @RequestParam(value = "offset", required = false) Integer offset) {
        return api.movimientosCaja(from, to, limit, offset);
    }

    @PostMapping("/movements")
    public MovimientoCajaResponse crear(@RequestBody MovimientoCajaRequest req) {
        return api.crearMovimientoCaja(req);
    }
}
