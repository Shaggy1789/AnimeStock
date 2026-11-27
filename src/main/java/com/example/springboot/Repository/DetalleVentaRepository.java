package com.example.springboot.Repository;

import com.example.springboot.Models.DetalleVenta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DetalleVentaRepository extends JpaRepository<DetalleVenta, Integer> {
    List<DetalleVenta> findByVentaId(int ventaId);

    List<DetalleVenta> findByProductoId(int productoId);
}
