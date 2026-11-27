package com.example.springboot.Service;

import com.example.springboot.Models.Producto;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public interface ServiceProductos {
    public List<Producto> findAll();
    public Producto findById(int id);
    public Producto findBySku(String sku);
    public List<Producto> findByNombre(String nombre);
    public List<Producto> findByAnime(String anime);
    public List<Producto> findByActivoTrue();
    public List<Producto> findByStockLessThan(int stock);
    public List<Producto> findByCategoriaId(int categoriaId);
    public Producto save(Producto producto);
    public Producto update(int id, Producto producto);
    public void deleteById(int id);
}
