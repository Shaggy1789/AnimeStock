package com.example.springboot.Controller;

import com.example.springboot.DTO.DashboardResponse;
import com.example.springboot.Service.ApiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    @Autowired
    private ApiService api;

    @GetMapping
    public DashboardResponse dashboard() {
        return api.dashboard();
    }
}
