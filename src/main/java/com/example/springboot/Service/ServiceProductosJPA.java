package com.example.springboot.Service;

import com.example.springboot.Models.Producto;
import com.example.springboot.Repository.ProductoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.List;

@Service
public class ServiceProductosJPA implements ServiceProductos {

    @Autowired
    private ProductoRepository productoRepository;

    @Override
    public List<Producto> findAll() {
        return productoRepository.findAll();
    }

    @Override
    public Producto findById(int id) {
        return productoRepository.findById(id).orElse(null);
    }

    @Override
    public Producto findBySku(String sku) {
        return productoRepository.findBySku(sku).orElse(null);
    }

    @Override
    public List<Producto> findByNombre(String nombre) {
        return productoRepository.findByNombreContainingIgnoreCase(nombre);
    }

    @Override
    public List<Producto> findByAnime(String anime) {
        return productoRepository.findByAnimeContainingIgnoreCase(anime);
    }

    @Override
    public List<Producto> findByActivoTrue() {
        return productoRepository.findByActivoTrue();
    }

    @Override
    public List<Producto> findByStockLessThan(int stock) {
        return productoRepository.findByStockLessThan(stock);
    }

    @Override
    public List<Producto> findByCategoriaId(int categoriaId) {
        return productoRepository.findByCategoriaId(categoriaId);
    }

    @Override
    public Producto save(Producto producto) {
        if (producto == null) {
            throw new RuntimeException();
        }
        
        if (producto.getSku() == null || producto.getSku().isBlank()) {
            producto.setSku(generarSku(producto.getNombre()));
        }
        return productoRepository.save(producto);
    }

    
    private String generarSku(String nombre) {
        String bloque = tresLetras(nombre);
        String sku;
        int intentos = 0;
        do {
            sku = "PLU-" + bloque + "-" + dosAlfanumericos();
            intentos++;
        } while (productoRepository.findBySku(sku).isPresent() && intentos < MAX_INTENTOS_SKU);
        return sku;
    }

    
    private String tresLetras(String nombre) {
        StringBuilder sb = new StringBuilder();
        if (nombre != null) {
            for (char c : nombre.toUpperCase().toCharArray()) {
                if (c >= 'A' && c <= 'Z') {
                    sb.append(c);
                    if (sb.length() == 3) {
                        break;
                    }
                }
            }
        }
        while (sb.length() < 3) {
            sb.append(LETRAS[RANDOM.nextInt(LETRAS.length)]);
        }
        return sb.toString();
    }

    
    private String dosAlfanumericos() {
        return "" + ALFANUMERICO[RANDOM.nextInt(ALFANUMERICO.length)]
                  + ALFANUMERICO[RANDOM.nextInt(ALFANUMERICO.length)];
    }

    @Override
    public Producto update(int id, Producto producto) {
        Producto existente = productoRepository.findById(id).orElse(null);
        if (existente == null) {
            return null;
        }

        
        if (producto.getSku() != null && !producto.getSku().isBlank()) {
            existente.setSku(producto.getSku());
        }
        existente.setNombre(producto.getNombre());
        existente.setAnime(producto.getAnime());
        existente.setCategoria(producto.getCategoria());
        existente.setCosto(producto.getCosto());
        existente.setPrecio(producto.getPrecio());
        existente.setStock(producto.getStock());
        existente.setStockMinimo(producto.getStockMinimo());
        existente.setActivo(producto.isActivo());

        return productoRepository.save(existente);
    }

    @Override
    public void deleteById(int id) {
        productoRepository.deleteById(id);
    }

    private static final int MAX_INTENTOS_SKU = 20;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final char[] LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".toCharArray();
    private static final char[] ALFANUMERICO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toCharArray();
}
