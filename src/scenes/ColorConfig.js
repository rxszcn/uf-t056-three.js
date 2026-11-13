import { SRGBColorSpace } from '../constants.js';
import { warn } from '../utils.js';

/**
 * Parser for the color configuration strings exported by the design tool.
 *
 * Two generations of grammar may be mixed inside the same configuration file:
 *
 * - **Legacy generation (CSS Color 3)**: comma separated components, e.g.
 *   `rgb(255, 0, 0)`, `rgba(255, 0, 0, 0.5)`, `hsl(120, 50%, 50%)`,
 *   `#ff0000`, `#f00` or an X11 color name such as `red`.
 * - **Current generation (CSS Color 4)**: space separated components with a
 *   slash separated alpha, angle units for hues and percentage hues, e.g.
 *   `rgb(255 0 0)`, `rgb(255 0 0 / 0.5)`, `hsl(120deg 50% 50%)`,
 *   `hsl(33.3% 50% 50%)` or `hsl(209.1rad 100% 50% / 75%)`.
 *
 * The keyword `none` represents an empty slot and leaves the target color
 * untouched. Channels outside their valid ranges are clamped and each clamp is
 * reported as a warning. Unrecognized input produces a warning as well and also
 * leaves the target color untouched.
 */

const _FUNCTION_PATTERN = /^([a-zA-Z]+)\((.*)\)$/;

const _NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const _PERCENT_PATTERN = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))%$/;
const _ANGLE_PATTERN = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(deg|grad|rad|turn)$/;

/**
 * Parses a single channel token. The returned object describes whether the
 * token uses a percentage or number syntax and its raw numeric value.
 *
 * @param {string} token - The channel token.
 * @return {?{value:number, percent:boolean}} The parsed token or `null` when
 * the token is not a number/percentage.
 */
function parseNumberToken( token ) {

	if ( _NUMBER_PATTERN.test( token ) ) {

		return { value: parseFloat( token ), percent: false };

	}

	const percentMatch = _PERCENT_PATTERN.exec( token );

	if ( percentMatch !== null ) {

		return { value: parseFloat( percentMatch[ 1 ] ), percent: true };

	}

	return null;

}

/**
 * Parses a hue token. Plain numbers are interpreted as degrees, percentages
 * are relative to a full turn and explicit angle units (`deg`, `grad`, `rad`,
 * `turn`) are converted to degrees.
 *
 * @param {string} token - The hue token.
 * @return {?number} The hue in degrees or `null` when the token is invalid.
 */
function parseHueToken( token ) {

	const angleMatch = _ANGLE_PATTERN.exec( token );

	if ( angleMatch !== null ) {

		const value = parseFloat( angleMatch[ 1 ] );
		const unit = angleMatch[ 2 ];

		switch ( unit ) {

			case 'deg': return value;
			case 'grad': return value * 360 / 400;
			case 'rad': return value * 180 / Math.PI;
			case 'turn': return value * 360;

		}

	}

	const number = parseNumberToken( token );

	if ( number === null ) return null;

	if ( number.percent ) {

		return number.value * 360 / 100;

	}

	return number.value;

}

/**
 * Clamps `value` to `[min,max]` and emits a warning when the value had to be
 * changed.
 *
 * @param {number} value - The unclamped value.
 * @param {number} min - The lower bound.
 * @param {number} max - The upper bound.
 * @param {string} channel - The channel name used in the warning.
 * @param {string} style - The original configuration string used in the warning.
 * @return {number} The clamped value.
 */
function clampChannel( value, min, max, channel, style ) {

	if ( value < min || value > max ) {

		warn( 'ColorConfig: ' + channel + ' channel of ' + style + ' is out of range and has been clamped.' );

		return Math.min( max, Math.max( min, value ) );

	}

	return value;

}

/**
 * Parses the slash separated alpha part of a CSS Color 4 color string.
 *
 * @param {string} alphaToken - The alpha token without the slash.
 * @param {string} style - The original configuration string.
 * @return {?number} The alpha in `[0,1]` or `null` when invalid.
 */
function parseAlpha( alphaToken, style ) {

	const alpha = parseNumberToken( alphaToken );

	if ( alpha === null ) return null;

	const value = alpha.percent ? alpha.value / 100 : alpha.value;

	return clampChannel( value, 0, 1, 'Alpha', style );

}

/**
 * Parses a space separated (CSS Color 4) `rgb`/`rgba` color.
 *
 * @param {string} components - The content inside the parentheses.
 * @param {string} style - The original configuration string.
 * @return {?{r:number,g:number,b:number}} The sRGB components in `[0,1]` or
 * `null` when the input is malformed.
 */
function parseModernRgb( components, style ) {

	const parts = components.split( '/' );

	if ( parts.length > 2 ) return null;

	const channelTokens = parts[ 0 ].trim().split( /\s+/ );

	if ( channelTokens.length !== 3 ) return null;

	const channels = [];

	for ( const token of channelTokens ) {

		const parsed = parseNumberToken( token );

		if ( parsed === null ) return null;

		if ( parsed.percent ) {

			channels.push( clampChannel( parsed.value, 0, 100, 'RGB', style ) / 100 );

		} else {

			channels.push( clampChannel( parsed.value, 0, 255, 'RGB', style ) / 255 );

		}

	}

	if ( parts.length === 2 ) {

		const alpha = parseAlpha( parts[ 1 ].trim(), style );

		if ( alpha === null ) return null;

		if ( alpha < 1 ) {

			warn( 'Color: Alpha component of ' + style + ' will be ignored.' );

		}

	}

	return { r: channels[ 0 ], g: channels[ 1 ], b: channels[ 2 ] };

}

/**
 * Parses a space separated (CSS Color 4) `hsl`/`hsla` color.
 *
 * @param {string} components - The content inside the parentheses.
 * @param {string} style - The original configuration string.
 * @return {?{h:number,s:number,l:number}} The HSL components in the ranges
 * expected by {@link Color#setHSL} or `null` when the input is malformed.
 */
function parseModernHsl( components, style ) {

	const parts = components.split( '/' );

	if ( parts.length > 2 ) return null;

	const channelTokens = parts[ 0 ].trim().split( /\s+/ );

	if ( channelTokens.length !== 3 ) return null;

	const hue = parseHueToken( channelTokens[ 0 ] );

	if ( hue === null ) return null;

	const saturationToken = parseNumberToken( channelTokens[ 1 ] );
	const lightnessToken = parseNumberToken( channelTokens[ 2 ] );

	if ( saturationToken === null || lightnessToken === null ) return null;
	if ( saturationToken.percent === false || lightnessToken.percent === false ) return null;

	const saturation = clampChannel( saturationToken.value, 0, 100, 'Saturation', style ) / 100;
	const lightness = clampChannel( lightnessToken.value, 0, 100, 'Lightness', style ) / 100;

	if ( parts.length === 2 ) {

		const alpha = parseAlpha( parts[ 1 ].trim(), style );

		if ( alpha === null ) return null;

		if ( alpha < 1 ) {

			warn( 'Color: Alpha component of ' + style + ' will be ignored.' );

		}

	}

	return { h: hue / 360, s: saturation, l: lightness };

}

/**
 * Parses a color configuration value into the given target color.
 *
 * Both the legacy comma separated grammar and the current space separated
 * grammar are supported and may be used interchangeably. The target color is
 * only modified when the input can be fully parsed, so malformed input and the
 * `none` placeholder leave the previous value intact.
 *
 * @param {Color} target - The color that receives the parsed result.
 * @param {string} value - The color configuration value.
 * @return {Color} The target color.
 */
function parseColorConfig( target, value ) {

	if ( typeof value !== 'string' ) {

		warn( 'ColorConfig: Unknown color ' + String( value ) );

		return target;

	}

	const style = value.trim();

	// The `none` keyword is an explicit empty slot: keep the previous value.
	if ( style === 'none' ) {

		return target;

	}

	if ( style.length === 0 ) {

		warn( 'ColorConfig: Unknown color ' + value );

		return target;

	}

	const functionMatch = _FUNCTION_PATTERN.exec( style );

	if ( functionMatch !== null ) {

		const name = functionMatch[ 1 ].toLowerCase();
		const components = functionMatch[ 2 ];

		// Legacy grammar keeps using commas. Delegate it to Color.setStyle so
		// its case-insensitive behavior and warning messages stay unchanged.
		if ( components.includes( ',' ) ) {

			target.setStyle( style );

			return target;

		}

		switch ( name ) {

			case 'rgb':
			case 'rgba': {

				const rgb = parseModernRgb( components, style );

				if ( rgb === null ) break;

				return target.setRGB( rgb.r, rgb.g, rgb.b, SRGBColorSpace );

			}

			case 'hsl':
			case 'hsla': {

				const hsl = parseModernHsl( components, style );

				if ( hsl === null ) break;

				return target.setHSL( hsl.h, hsl.s, hsl.l, SRGBColorSpace );

			}

			default:
				// Unknown color models share the legacy warning wording.
				warn( 'Color: Unknown color model ' + style );

				return target;

		}

		warn( 'ColorConfig: Unknown color ' + style );

		return target;

	}

	// Hex colors, X11 color names and any other legacy token are handled by the
	// existing parser, preserving the established warning messages.
	target.setStyle( style );

	return target;

}

export { parseColorConfig };
