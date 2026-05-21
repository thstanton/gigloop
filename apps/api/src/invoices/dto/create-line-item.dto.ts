export class CreateLineItemDto {
  description!: string;
  amount!: number;
  order?: number;
}
