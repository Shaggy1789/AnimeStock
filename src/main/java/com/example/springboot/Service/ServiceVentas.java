package com.example.springboot.Service;

import com.example.springboot.Models.EstadoVenta;
import com.example.springboot.Models.MetodoPago;
import com.example.springboot.Models.Venta;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public interface ServiceVentas {
    public List<Venta> findAll();
    public Venta findById(int id);
    public Venta findByNumeroComprobante(String numeroComprobante);
    public List<Venta> findByEstado(EstadoVenta estado);
    public List<Venta> findByMetodoPago(MetodoPago metodoPago);
    public List<Venta> findByVendidoEnBetween(LocalDateTime desde, LocalDateTime hasta);

    
    public Venta crearVenta(Venta venta);

    
    public Venta anularVenta(int id);

    
    public Venta actualizarVenta(int id, Venta nueva);

    public Venta save(Venta venta);
    public Venta update(int id, Venta venta);
    public void deleteById(int id);
}
