import { IsNotEmpty, IsString, IsOptional, IsEnum, IsArray, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, SUPPORTED_PAYMENT_METHODS } from '../../payment/enums/payment-method.enum';

export class BuyNftDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  listingId?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  auctionId?: string;

  @IsEnum(SUPPORTED_PAYMENT_METHODS, {
    message: `paymentMethod must be one of: ${SUPPORTED_PAYMENT_METHODS.join(', ')}`,
  })
  @IsNotEmpty()
  paymentMethod: PaymentMethod = PaymentMethod.XLM;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tokenAddress?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discountPercentage?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  stripePaymentIntentId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  paymentIntentSecret?: string;

  // For bundle payments
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bundleItemIds?: string[];
}