package com.example.springboot.Models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;


@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(name="MovimientoCaja")
public class MovimientoCaja {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Enumerated(EnumType.STRING)
    private TipoMovimiento tipo;

    private BigDecimal monto;
    private String descripcion;

    @ManyToOne
    @JoinColumn(name = "venta_id")
    private Venta venta;

    private LocalDateTime ocurridoEn;
}
