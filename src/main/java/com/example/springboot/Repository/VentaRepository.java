package com.example.springboot.Repository;

import com.example.springboot.Models.EstadoVenta;
import com.example.springboot.Models.MetodoPago;
import com.example.springboot.Models.Venta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface VentaRepository extends JpaRepository<Venta, Integer> {
    Optional<Venta> findByNumeroComprobante(String numeroComprobante);

    List<Venta> findByEstado(EstadoVenta estado);

    List<Venta> findByEstadoNot(EstadoVenta estado);

    List<Venta> findByMetodoPago(MetodoPago metodoPago);

    List<Venta> findByEstadoAndMetodoPago(EstadoVenta estado, MetodoPago metodoPago);

    List<Venta> findByVendidoEnBetween(LocalDateTime desde, LocalDateTime hasta);

    long countByVendidoEnBetween(LocalDateTime desde, LocalDateTime hasta);
}
