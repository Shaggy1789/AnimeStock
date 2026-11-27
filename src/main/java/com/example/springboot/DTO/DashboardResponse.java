package com.example.springboot.DTO;

import java.math.BigDecimal;
import java.util.List;


public record DashboardResponse(
        List<Kpi> kpis,
        List<Punto> monthlyRevenue,
        List<CategoriaPunto> categorySales,
        List<RecentSale> recentSales
) {
    public record Kpi(
            String title,
            String value,
            String icon,
            String growth,
            String growthType,
            String color,
            String subtitle
    ) {
    }

    public record Punto(String label, BigDecimal value) {
    }

    public record CategoriaPunto(String label, long value, String color) {
    }

    public record RecentSale(
            String customer,
            String initials,
            String product,
            String date,
            String amount,
            String estado,
            String metodoPago,
            int stock
    ) {
    }
}
