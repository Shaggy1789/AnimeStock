package com.example.springboot.Service;

import com.example.springboot.Models.Foto;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@Service
public interface ServiceFotos {
    public List<Foto> findAll();
    public Foto findById(int id);
    public Foto save(MultipartFile archivo, String descripcion) throws IOException;
    public Foto update(int id, String descripcion);
    public void deleteById(int id);

}
