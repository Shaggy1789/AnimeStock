package com.example.springboot.Repository;

import com.example.springboot.Models.Foto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FotoRepository extends JpaRepository<Foto, Integer> {
    List<Foto> findByNombre(String nombre);

    List<Foto> findByProductoId(int productoId);

    
    Optional<Foto> findFirstByProductoIdOrderByEsPrincipalDescOrdenAsc(int productoId);
}
