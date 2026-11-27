package com.example.springboot.Controller;

import com.example.springboot.DTO.CategoriaRequest;
import com.example.springboot.DTO.CategoriaResponse;
import com.example.springboot.Service.ApiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;


@RestController
@RequestMapping("/api/categories")
public class CategoriaController {

    @Autowired
    private ApiService api;

    @GetMapping
    public List<CategoriaResponse> listar() {
        return api.listarCategorias();
    }

    @PostMapping
    public CategoriaResponse crear(@RequestBody CategoriaRequest req) {
        return api.crearCategoria(req != null ? req.nombre() : null);
    }

    @PutMapping("/{id}")
    public ResponseEntity<CategoriaResponse> actualizar(@PathVariable int id,
                                                        @RequestBody CategoriaRequest req) {
        CategoriaResponse c = api.actualizarCategoria(id, req != null ? req.nombre() : null);
        return c == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(c);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> borrar(@PathVariable int id) {
        return api.borrarCategoria(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
