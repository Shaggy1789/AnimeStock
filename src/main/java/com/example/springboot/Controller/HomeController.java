package com.example.springboot.Controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;


@Controller
public class HomeController {

    @GetMapping("/")
    public String dashboard() {
        return "index";
    }

    @GetMapping("/inventario")
    public String inventario() {
        return "inventario";
    }

    @GetMapping("/proveedores")
    public String proveedores() {
        return "proveedores";
    }

    @GetMapping("/ventas")
    public String ventas() {
        return "ventas";
    }

    @GetMapping("/pedidos")
    public String pedidos() {
        return "pedidos";
    }

    @GetMapping("/caja")
    public String caja() {
        return "caja";
    }

    @GetMapping("/reportes")
    public String reportes() {
        return "reportes";
    }

    @GetMapping("/configuracion")
    public String configuracion() {
        return "configuracion";
    }
}
