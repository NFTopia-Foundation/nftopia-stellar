
import { ApiProperty } from '@nestjs/swagger';

export class StellarNftDto {
    @ApiProperty()
    contractId: string;

    @ApiProperty()
    tokenId: string;

    @ApiProperty()
    owner: string;

    @ApiProperty({ required: false })
    metadataUri?: string;

    @ApiProperty({ required: false })
    name?: string;

    @ApiProperty({ required: false })
    description?: string;

    @ApiProperty({ required: false })
    image?: string;
}
