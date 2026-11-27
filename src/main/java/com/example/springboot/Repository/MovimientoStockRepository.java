package com.example.springboot.Repository;

import com.example.springboot.Models.MovimientoStock;
import com.example.springboot.Models.TipoMovimientoStock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MovimientoStockRepository extends JpaRepository<MovimientoStock, Integer> {
    List<MovimientoStock> findByProductoId(int productoId);

    List<MovimientoStock> findByVentaId(int ventaId);

    List<MovimientoStock> findByTipo(TipoMovimientoStock tipo);

    List<MovimientoStock> findByOcurridoEnBetween(LocalDateTime desde, LocalDateTime hasta);
}
