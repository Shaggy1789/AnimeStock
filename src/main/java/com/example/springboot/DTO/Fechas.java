package com.example.springboot.DTO;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;


public final class Fechas {

    private Fechas() {
    }

    public static LocalDateTime parse(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        String s = valor.trim();
        try {
            return LocalDateTime.parse(s);
        } catch (RuntimeException ignored) {
            
        }
        try {
            return OffsetDateTime.parse(s).toLocalDateTime();
        } catch (RuntimeException ignored) {
            
        }
        try {
            return Instant.parse(s).atZone(ZoneId.systemDefault()).toLocalDateTime();
        } catch (RuntimeException ignored) {
            
        }
        try {
            return LocalDate.parse(s).atStartOfDay();
        } catch (RuntimeException ignored) {
            
        }
        return null;
    }
}
