package com.example.springboot.DTO;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;


public record CajaMovimientosResponse(
        List<MovimientoCajaResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        Summary summary,
        LocalDateTime from,
        LocalDateTime to
) {
    public record Summary(BigDecimal income, BigDecimal expense, BigDecimal balance) {
    }
}
