import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import type { Request } from 'express';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { BookingSearchResultDto, ContactSearchResultDto } from './dto/search-result.dto';

type AuthedRequest = Request & { userId: string };

// ADR-0067 §3: the wire shape is a discriminated array, not `{ bookings, contacts }`, so a new
// searchable entity is a new `type` value rather than a response-shape change. `oneOf` documents
// the two current variants for Scalar.
const SEARCH_RESULT_SCHEMA = {
  type: 'array' as const,
  items: {
    oneOf: [{ $ref: getSchemaPath(BookingSearchResultDto) }, { $ref: getSchemaPath(ContactSearchResultDto) }],
  },
};

@ApiTags('Search')
@ApiBearerAuth('clerk-jwt')
@ApiExtraModels(BookingSearchResultDto, ContactSearchResultDto)
@Controller('search')
export class SearchController {
  constructor(private service: SearchService) {}

  @ApiOperation({
    summary:
      'Command-palette search across bookings (all six statuses) and contacts, grouped by type, top-N per type',
  })
  @ApiResponse({ status: 200, schema: SEARCH_RESULT_SCHEMA })
  @Get()
  search(@Req() req: AuthedRequest, @Query() query: SearchQueryDto) {
    return this.service.search(req.userId, query.q);
  }
}
