package com.example.springboot.Service;

import com.example.springboot.Models.Categoria;
import com.example.springboot.Repository.CategoriaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ServiceCategoriasJPA implements ServiceCategorias {

    @Autowired
    private CategoriaRepository categoriaRepository;

    @Override
    public List<Categoria> findAll() {
        return categoriaRepository.findAll();
    }

    @Override
    public Categoria findById(int id) {
        return categoriaRepository.findById(id).orElse(null);
    }

    @Override
    public Categoria findByNombre(String nombre) {
        return categoriaRepository.findByNombre(nombre).orElse(null);
    }

    @Override
    public Categoria save(Categoria categoria) {
        if (categoria == null) {
            throw new RuntimeException();
        }
        return categoriaRepository.save(categoria);
    }

    @Override
    public Categoria update(int id, Categoria categoria) {
        Categoria existente = categoriaRepository.findById(id).orElse(null);
        if (existente == null) {
            return null;
        }

        existente.setNombre(categoria.getNombre());

        return categoriaRepository.save(existente);
    }

    @Override
    public void deleteById(int id) {
        categoriaRepository.deleteById(id);
    }
}
