package com.example.springboot.Service;

import com.example.springboot.Models.Categoria;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public interface ServiceCategorias {
    public List<Categoria> findAll();
    public Categoria findById(int id);
    public Categoria findByNombre(String nombre);
    public Categoria save(Categoria categoria);
    public Categoria update(int id, Categoria categoria);
    public void deleteById(int id);
}
