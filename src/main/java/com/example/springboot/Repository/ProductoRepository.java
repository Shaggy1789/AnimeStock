package com.example.springboot.Repository;

import com.example.springboot.Models.Producto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductoRepository extends JpaRepository<Producto, Integer> {
    Optional<Producto> findBySku(String sku);

    List<Producto> findByNombreContainingIgnoreCase(String nombre);

    List<Producto> findByAnimeContainingIgnoreCase(String anime);

    List<Producto> findByNombreContainingIgnoreCaseOrAnimeContainingIgnoreCase(String nombre, String anime);

    List<Producto> findByActivoTrue();

    List<Producto> findByStockLessThan(int stock);

    List<Producto> findByCategoriaId(int categoriaId);
}
