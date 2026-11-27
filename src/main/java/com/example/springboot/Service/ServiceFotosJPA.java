package com.example.springboot.Service;

import com.example.springboot.Models.Foto;
import com.example.springboot.Repository.FotoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@Service
public class ServiceFotosJPA implements ServiceFotos{

    @Autowired
    private FotoRepository fotoRepository;

    @Override
    public List<Foto> findAll(){
        return fotoRepository.findAll();
    }

    @Override
    public Foto findById(int id){
        return fotoRepository.findById(id).orElse(null);
    }

    @Override
    public Foto save(MultipartFile archivo, String description) throws IOException {
        Foto foto = new Foto();
        foto.setNombre(archivo.getOriginalFilename());
        foto.setDescripcion(description);
        foto.setTipo(archivo.getContentType());
        foto.setTamanio(archivo.getSize());
        foto.setDatos(archivo.getBytes());

        return fotoRepository.save(foto);
    }

    @Override
    public Foto update(int id, String descripcion) {
        Foto foto = fotoRepository.findById(id).orElse(null);
        if(foto == null){
            return null;
        }
        foto.setDescripcion(descripcion);
        return fotoRepository.save(foto);
    }

    @Override
    public void deleteById(int id) {
        fotoRepository.deleteById(id);
    }
}
