import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginationDto } from '../dto/pagination.dto';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

@Injectable()
export class PaginationInterceptor<T> implements NestInterceptor<PaginatedResponse<T>, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const query = request.query as PaginationDto;
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    console.log('[PaginationInterceptor] Intercepting request:', request.method, request.url, 'query:', query);

    return next.handle().pipe(
      map((data) => {
        console.log('[PaginationInterceptor] Response data type:', typeof data, 'keys:', data ? Object.keys(data) : 'null');
        // Only transform if the response has the { items, total } shape
        if (data && typeof data === 'object' && 'items' in data && 'total' in data) {
          console.log('[PaginationInterceptor] Transforming pagination response');
          const { items, total } = data as PaginatedResponse<T>;
          const totalPages = Math.ceil(total / limit);

          return {
            data: items,
            meta: {
              total,
              page,
              limit,
              totalPages,
              hasNextPage: page < totalPages,
              hasPreviousPage: page > 1,
            },
          };
        }
        // Pass through unchanged for non-paginated responses
        console.log('[PaginationInterceptor] Not transforming, passing through');
        return data;
      }),
    );
  }
}