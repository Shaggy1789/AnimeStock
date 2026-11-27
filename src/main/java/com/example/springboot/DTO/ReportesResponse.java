package com.example.springboot.DTO;

import java.math.BigDecimal;
import java.util.List;


public record ReportesResponse(
        String from,
        String to,
        KpisReporte kpis,
        List<VentaResponse> sales
) {
    public record KpisReporte(
            BigDecimal revenue,
            BigDecimal profit,
            BigDecimal avgTicket,
            BigDecimal margin,
            DeltasReporte deltas
    ) {
    }

    public record DeltasReporte(
            BigDecimal revenue,
            BigDecimal profit,
            BigDecimal avgTicket,
            BigDecimal margin
    ) {
    }
}