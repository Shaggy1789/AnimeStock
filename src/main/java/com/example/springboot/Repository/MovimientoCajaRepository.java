package com.example.springboot.Repository;

import com.example.springboot.Models.MovimientoCaja;
import com.example.springboot.Models.TipoMovimiento;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MovimientoCajaRepository extends JpaRepository<MovimientoCaja, Integer> {
    List<MovimientoCaja> findByTipo(TipoMovimiento tipo);

    List<MovimientoCaja> findByVentaId(int ventaId);

    List<MovimientoCaja> findByOcurridoEnBetween(LocalDateTime desde, LocalDateTime hasta);

    List<MovimientoCaja> findByOcurridoEnGreaterThanEqual(LocalDateTime desde);
}
