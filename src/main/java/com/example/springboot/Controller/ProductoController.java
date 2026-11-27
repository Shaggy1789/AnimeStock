package com.example.springboot.Controller;

import com.example.springboot.DTO.PaginaResponse;
import com.example.springboot.DTO.ProductoRequest;
import com.example.springboot.DTO.ProductoResponse;
import com.example.springboot.Models.Foto;
import com.example.springboot.Service.ApiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;


@RestController
@RequestMapping("/api/products")
public class ProductoController {

    @Autowired
    private ApiService api;

    @GetMapping
    public PaginaResponse<ProductoResponse> listar(
            @RequestParam(value = "query", required = false) String query,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "inStockOnly", defaultValue = "false") boolean inStockOnly,
            @RequestParam(value = "limit", required = false) Integer limit) {
        return api.listarProductos(query, category, inStockOnly, limit);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductoResponse> obtener(@PathVariable int id) {
        ProductoResponse p = api.producto(id);
        return p == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(p);
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> imagen(@PathVariable int id) {
        Foto foto = api.fotoPrincipal(id);
        if (foto == null || foto.getDatos() == null) {
            return ResponseEntity.notFound().build();
        }
        MediaType tipo = MediaType.APPLICATION_OCTET_STREAM;
        if (foto.getTipo() != null && !foto.getTipo().isBlank()) {
            try {
                tipo = MediaType.parseMediaType(foto.getTipo());
            } catch (RuntimeException ignored) {
                
            }
        }
        return ResponseEntity.ok()
                .contentType(tipo)
                .header("X-Content-Type-Options", "nosniff")
                .header("Cache-Control", "no-cache")
                .body(foto.getDatos());
    }

    @PostMapping(path = "/{id}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProductoResponse> subirImagen(@PathVariable int id,
                                                        @RequestParam("file") MultipartFile file) {
        byte[] datos;
        try {
            datos = file.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("No se pudo leer la imagen subida");
        }
        ProductoResponse p = api.guardarFoto(id, file.getOriginalFilename(),
                file.getContentType(), file.getSize(), datos);
        return p == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(p);
    }

    @DeleteMapping("/{id}/image")
    public ResponseEntity<ProductoResponse> borrarImagen(@PathVariable int id) {
        ProductoResponse p = api.borrarFoto(id);
        return p == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(p);
    }

    @PostMapping
    public ProductoResponse crear(@RequestBody ProductoRequest req) {
        return api.crearProducto(req);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductoResponse> actualizar(@PathVariable int id, @RequestBody ProductoRequest req) {
        ProductoResponse p = api.actualizarProducto(id, req);
        return p == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(p);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> borrar(@PathVariable int id) {
        return api.borrarProducto(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
