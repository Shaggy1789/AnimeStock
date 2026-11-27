package com.example.springboot.Service;

import com.example.springboot.Models.MovimientoCaja;
import com.example.springboot.Models.TipoMovimiento;
import com.example.springboot.Repository.MovimientoCajaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ServiceMovimientosCajaJPA implements ServiceMovimientosCaja {

    @Autowired
    private MovimientoCajaRepository movimientoCajaRepository;

    @Override
    public List<MovimientoCaja> findAll() {
        return movimientoCajaRepository.findAll();
    }

    @Override
    public MovimientoCaja findById(int id) {
        return movimientoCajaRepository.findById(id).orElse(null);
    }

    @Override
    public List<MovimientoCaja> findByTipo(TipoMovimiento tipo) {
        return movimientoCajaRepository.findByTipo(tipo);
    }

    @Override
    public List<MovimientoCaja> findByVentaId(int ventaId) {
        return movimientoCajaRepository.findByVentaId(ventaId);
    }

    @Override
    public List<MovimientoCaja> findByOcurridoEnBetween(LocalDateTime desde, LocalDateTime hasta) {
        return movimientoCajaRepository.findByOcurridoEnBetween(desde, hasta);
    }

    @Override
    public MovimientoCaja save(MovimientoCaja movimiento) {
        if (movimiento == null) {
            throw new RuntimeException();
        }
        return movimientoCajaRepository.save(movimiento);
    }

    @Override
    public MovimientoCaja update(int id, MovimientoCaja movimiento) {
        MovimientoCaja existente = movimientoCajaRepository.findById(id).orElse(null);
        if (existente == null) {
            return null;
        }

        existente.setTipo(movimiento.getTipo());
        existente.setMonto(movimiento.getMonto());
        existente.setDescripcion(movimiento.getDescripcion());
        existente.setVenta(movimiento.getVenta());
        existente.setOcurridoEn(movimiento.getOcurridoEn());

        return movimientoCajaRepository.save(existente);
    }

    @Override
    public void deleteById(int id) {
        movimientoCajaRepository.deleteById(id);
    }
}
