package com.example.springboot.Models;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;


@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(name="Foto")
public class Foto {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    private String nombre;
    private String descripcion;
    private String tipo;
    private long tamanio;

    @JdbcTypeCode(SqlTypes.BINARY)
    @Column(columnDefinition = "BYTEA",nullable = false)
    private byte[] datos;

    @ManyToOne
    @JoinColumn(name = "producto_id")
    private Producto producto;

    @Column(columnDefinition = "boolean default false", nullable = false)
    private boolean esPrincipal;

    @Column(columnDefinition = "integer default 0", nullable = false)
    private int orden;
}



