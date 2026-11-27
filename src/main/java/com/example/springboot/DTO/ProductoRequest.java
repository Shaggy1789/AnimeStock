package com.example.springboot.DTO;

import java.math.BigDecimal;


public record ProductoRequest(
        String sku,
        String nombre,
        String anime,
        Integer categoriaId,
        BigDecimal costo,
        BigDecimal precio,
        Integer stock,
        Integer stockMinimo,
        Boolean activo
) {
}
