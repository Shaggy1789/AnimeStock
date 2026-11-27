package com.example.springboot.Controller;

import com.example.springboot.DTO.ClienteRequest;
import com.example.springboot.DTO.ClienteSnapshot;
import com.example.springboot.DTO.PaginaResponse;
import com.example.springboot.Service.ApiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/api/customers")
public class ClienteController {

    @Autowired
    private ApiService api;

    @GetMapping
    public PaginaResponse<ClienteSnapshot> listar(
            @RequestParam(value = "q", required = false) String q) {
        return api.listarClientes(q);
    }

    @PostMapping
    public ClienteSnapshot crear(@RequestBody(required = false) ClienteRequest req) {
        return api.crearCliente(req);
    }
}