package com.example.springboot.Models;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;


@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(name="MovimientoStock")
public class MovimientoStock {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @ManyToOne
    @JoinColumn(name = "producto_id")
    private Producto producto;

    @Enumerated(EnumType.STRING)
    private TipoMovimientoStock tipo;

    private int cantidad;
    private int stockResultante;
    private String motivo;

    @ManyToOne
    @JoinColumn(name = "venta_id")
    private Venta venta;

    private LocalDateTime ocurridoEn;
}
