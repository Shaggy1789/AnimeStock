package com.example.springboot.Controller;

import com.example.springboot.DTO.ReportesResponse;
import com.example.springboot.Service.ApiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/api/reports")
public class ReportesController {

    @Autowired
    private ApiService api;

    @GetMapping
    public ReportesResponse reportes(
            @RequestParam(value = "from", required = false) String from,
            @RequestParam(value = "to", required = false) String to) {
        return api.reportes(from, to);
    }
}