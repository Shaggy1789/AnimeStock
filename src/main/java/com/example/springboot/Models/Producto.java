package com.example.springboot.Models;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;


@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(name="Producto")
public class Producto {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;

    @Column(unique = true)
    private String sku;

    @Column(nullable = false)
    private String nombre;

    private String anime;

    @ManyToOne
    @JoinColumn(name = "categoria_id")
    private Categoria categoria;

    private BigDecimal costo;
    private BigDecimal precio;

    private int stock;
    private int stockMinimo;

    private boolean activo = true;

    @OneToMany(mappedBy = "producto", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Foto> fotos;
}
