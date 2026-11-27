package com.example.springboot.Service;

import com.example.springboot.Models.MovimientoCaja;
import com.example.springboot.Models.TipoMovimiento;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public interface ServiceMovimientosCaja {
    public List<MovimientoCaja> findAll();
    public MovimientoCaja findById(int id);
    public List<MovimientoCaja> findByTipo(TipoMovimiento tipo);
    public List<MovimientoCaja> findByVentaId(int ventaId);
    public List<MovimientoCaja> findByOcurridoEnBetween(LocalDateTime desde, LocalDateTime hasta);
    public MovimientoCaja save(MovimientoCaja movimiento);
    public MovimientoCaja update(int id, MovimientoCaja movimiento);
    public void deleteById(int id);
}
