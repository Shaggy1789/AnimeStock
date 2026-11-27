package com.example.springboot.Models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;


@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(name="Venta")
public class Venta {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(unique = true)
    private String numeroComprobante;

    private BigDecimal subtotal;
    private BigDecimal descuento;
    private BigDecimal total;

    @Enumerated(EnumType.STRING)
    private MetodoPago metodoPago;

    @Enumerated(EnumType.STRING)
    private EstadoVenta estado;

    private String referencia;
    private String notas;

    private BigDecimal montoRecibido;
    private BigDecimal vuelto;

    private LocalDateTime vendidoEn;
    private LocalDateTime enviadoEn;
    private LocalDateTime anuladoEn;

    @OneToMany(mappedBy = "venta", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DetalleVenta> detalles;
}
