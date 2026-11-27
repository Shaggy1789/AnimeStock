package com.example.springboot.Service;

import com.example.springboot.Models.MovimientoStock;
import com.example.springboot.Models.TipoMovimientoStock;
import com.example.springboot.Repository.MovimientoStockRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ServiceMovimientosStockJPA implements ServiceMovimientosStock {

    @Autowired
    private MovimientoStockRepository movimientoStockRepository;

    @Override
    public List<MovimientoStock> findAll() {
        return movimientoStockRepository.findAll();
    }

    @Override
    public MovimientoStock findById(int id) {
        return movimientoStockRepository.findById(id).orElse(null);
    }

    @Override
    public List<MovimientoStock> findByProductoId(int productoId) {
        return movimientoStockRepository.findByProductoId(productoId);
    }

    @Override
    public List<MovimientoStock> findByVentaId(int ventaId) {
        return movimientoStockRepository.findByVentaId(ventaId);
    }

    @Override
    public List<MovimientoStock> findByTipo(TipoMovimientoStock tipo) {
        return movimientoStockRepository.findByTipo(tipo);
    }

    @Override
    public List<MovimientoStock> findByOcurridoEnBetween(LocalDateTime desde, LocalDateTime hasta) {
        return movimientoStockRepository.findByOcurridoEnBetween(desde, hasta);
    }

    @Override
    public MovimientoStock save(MovimientoStock movimiento) {
        if (movimiento == null) {
            throw new RuntimeException();
        }
        return movimientoStockRepository.save(movimiento);
    }

    @Override
    public MovimientoStock update(int id, MovimientoStock movimiento) {
        MovimientoStock existente = movimientoStockRepository.findById(id).orElse(null);
        if (existente == null) {
            return null;
        }

        existente.setProducto(movimiento.getProducto());
        existente.setTipo(movimiento.getTipo());
        existente.setCantidad(movimiento.getCantidad());
        existente.setStockResultante(movimiento.getStockResultante());
        existente.setMotivo(movimiento.getMotivo());
        existente.setVenta(movimiento.getVenta());
        existente.setOcurridoEn(movimiento.getOcurridoEn());

        return movimientoStockRepository.save(existente);
    }

    @Override
    public void deleteById(int id) {
        movimientoStockRepository.deleteById(id);
    }
}
