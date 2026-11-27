package com.example.springboot.DTO;

import java.time.LocalDateTime;
import java.util.List;


public record PaginaResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        LocalDateTime from,
        LocalDateTime to
) {
    public static <T> PaginaResponse<T> of(List<T> content, int page, int size, long totalElements,
                                           LocalDateTime from, LocalDateTime to) {
        int totalPages = size > 0 ? (int) Math.max(1, Math.ceil((double) totalElements / size)) : 1;
        return new PaginaResponse<>(content, page, size, totalElements, totalPages, from, to);
    }
}
