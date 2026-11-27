package com.example.springboot.Service;

import com.example.springboot.Models.MovimientoStock;
import com.example.springboot.Models.TipoMovimientoStock;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public interface ServiceMovimientosStock {
    public List<MovimientoStock> findAll();
    public MovimientoStock findById(int id);
    public List<MovimientoStock> findByProductoId(int productoId);
    public List<MovimientoStock> findByVentaId(int ventaId);
    public List<MovimientoStock> findByTipo(TipoMovimientoStock tipo);
    public List<MovimientoStock> findByOcurridoEnBetween(LocalDateTime desde, LocalDateTime hasta);
    public MovimientoStock save(MovimientoStock movimiento);
    public MovimientoStock update(int id, MovimientoStock movimiento);
    public void deleteById(int id);
}
