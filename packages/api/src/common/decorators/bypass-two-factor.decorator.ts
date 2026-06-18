import { SetMetadata } from '@nestjs/common';

export const BYPASS_TWO_FACTOR_KEY = 'bypassTwoFactor';
export const BypassTwoFactor = () => SetMetadata(BYPASS_TWO_FACTOR_KEY, true);
