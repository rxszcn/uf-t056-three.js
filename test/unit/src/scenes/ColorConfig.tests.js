import { Color } from '../../../../src/math/Color.js';
import { ColorManagement } from '../../../../src/math/ColorManagement.js';
import { parseColorConfig } from '../../../../src/scenes/ColorConfig.js';
import { getConsoleFunction, setConsoleFunction } from '../../../../src/utils.js';
import { eps } from '../../utils/math-constants.js';

export default QUnit.module( 'Scenes', () => {

	QUnit.module( 'ColorConfig', () => {

		const colorManagementEnabled = ColorManagement.enabled;
		const consoleFunction = getConsoleFunction();
		let warnings;

		QUnit.testStart( () => {

			ColorManagement.enabled = false;
			warnings = [];
			setConsoleFunction( ( type, ...params ) => {

				if ( type === 'warn' ) warnings.push( params.join( ' ' ) );

			} );

		} );

		QUnit.testDone( () => {

			ColorManagement.enabled = colorManagementEnabled;
			setConsoleFunction( consoleFunction );

		} );

		function colorClose( assert, actual, expected, message ) {

			assert.ok( Math.abs( actual.r - expected.r ) < eps, message + ' (r)' );
			assert.ok( Math.abs( actual.g - expected.g ) < eps, message + ' (g)' );
			assert.ok( Math.abs( actual.b - expected.b ) < eps, message + ' (b)' );

		}

		// LEGACY GRAMMAR (comma separated, unchanged behavior)

		QUnit.test( 'legacy rgb/rgba comma separated', ( assert ) => {

			const target = new Color();

			parseColorConfig( target, 'rgb(255, 128, 0)' );
			colorClose( assert, target, new Color().setRGB( 1, 128 / 255, 0 ), 'rgb' );

			parseColorConfig( target, 'rgba(10, 20, 30, 0.5)' );
			colorClose( assert, target, new Color().setRGB( 10 / 255, 20 / 255, 30 / 255 ), 'rgba ignores alpha' );
			assert.equal( warnings.length, 1, 'rgba alpha < 1 keeps the legacy alpha warning' );

		} );

		QUnit.test( 'legacy rgb percentage and hsl comma separated', ( assert ) => {

			const target = new Color();

			parseColorConfig( target, 'rgb(100%, 50%, 10%)' );
			colorClose( assert, target, new Color().setRGB( 1, 0.5, 0.1 ), 'rgb percentages' );

			parseColorConfig( target, 'hsl(120, 50%, 50%)' );
			colorClose( assert, target, new Color().setHSL( 120 / 360, 0.5, 0.5 ), 'hsl' );

			parseColorConfig( target, 'hsla(240, 100%, 25%, 0.25)' );
			colorClose( assert, target, new Color().setHSL( 240 / 360, 1, 0.25 ), 'hsla' );

			assert.equal( warnings.length, 1, 'hsla alpha < 1 keeps the legacy alpha warning' );

		} );

		QUnit.test( 'legacy hex and color names are case insensitive', ( assert ) => {

			const target = new Color();

			parseColorConfig( target, '#ff8000' );
			assert.equal( target.getHex(), 0xff8000, 'lowercase hex' );

			parseColorConfig( target, '#FF8000' );
			assert.equal( target.getHex(), 0xff8000, 'uppercase hex' );

			parseColorConfig( target, '#f80' );
			assert.equal( target.getHex(), 0xff8800, 'short hex' );

			parseColorConfig( target, 'ReD' );
			assert.equal( target.getHex(), 0xff0000, 'color name ignores case' );

			parseColorConfig( target, 'SkyBlue' );
			assert.equal( target.getHex(), 0x87ceeb, 'mixed case color name' );

			assert.equal( warnings.length, 0, 'no warnings for valid legacy values' );

		} );

		QUnit.test( 'legacy warning messages are unchanged', ( assert ) => {

			const target = new Color( 0x112233 );

			parseColorConfig( target, '#12345' );
			assert.equal( warnings.length, 1, 'invalid hex warns once' );
			assert.ok( warnings[ 0 ].includes( 'Color: Invalid hex color #12345' ), 'invalid hex wording' );

			warnings.length = 0;
			parseColorConfig( target, 'notacolor' );
			assert.equal( warnings.length, 1, 'unknown name warns once' );
			assert.ok( warnings[ 0 ].includes( 'Color: Unknown color notacolor' ), 'unknown color wording' );

			warnings.length = 0;
			parseColorConfig( target, 'cmyk(1, 2, 3)' );
			assert.equal( warnings.length, 1, 'unknown model warns once' );
			assert.ok( warnings[ 0 ].includes( 'Color: Unknown color model cmyk(1, 2, 3)' ), 'unknown model wording' );			assert.equal( target.getHex(), 0x112233, 'unrecognized inputs keep the previous value' );

		} );

		// CURRENT GRAMMAR (space separated)

		QUnit.test( 'modern rgb space separated channels', ( assert ) => {

			const target = new Color();

			parseColorConfig( target, 'rgb(255 128 0)' );
			colorClose( assert, target, new Color().setRGB( 1, 128 / 255, 0 ), 'space separated rgb' );

			parseColorConfig( target, 'rgba(255 128 0)' );
			colorClose( assert, target, new Color().setRGB( 1, 128 / 255, 0 ), 'rgba without alpha' );

			parseColorConfig( target, 'rgb(100% 50% 10%)' );
			colorClose( assert, target, new Color().setRGB( 1, 0.5, 0.1 ), 'space separated percentages' );

			parseColorConfig( target, 'rgb(255 50% 0)' );
			colorClose( assert, target, new Color().setRGB( 1, 0.5, 0 ), 'mixed number and percentage channels' );

			assert.equal( warnings.length, 0, 'no warnings for valid modern rgb' );

		} );

		QUnit.test( 'modern rgb slash alpha', ( assert ) => {

			const target = new Color();

			parseColorConfig( target, 'rgb(255 0 0 / 0.5)' );
			colorClose( assert, target, new Color().setRGB( 1, 0, 0 ), 'slash alpha is ignored' );
			assert.equal( warnings.length, 1, 'alpha < 1 warns' );
			assert.ok( warnings[ 0 ].includes( 'Color: Alpha component of rgb(255 0 0 / 0.5) will be ignored.' ), 'alpha wording' );

			warnings.length = 0;
			parseColorConfig( target, 'rgb(0 255 0 / 100%)' );
			colorClose( assert, target, new Color().setRGB( 0, 1, 0 ), 'percentage alpha 100%' );
			assert.equal( warnings.length, 0, 'full alpha does not warn' );

			warnings.length = 0;
			parseColorConfig( target, 'rgb(0 0 255 / 25%)' );
			colorClose( assert, target, new Color().setRGB( 0, 0, 1 ), 'percentage alpha 25%' );
			assert.equal( warnings.length, 1, 'partial percentage alpha warns' );

		} );

		QUnit.test( 'modern hsl with angle units and percentage hue', ( assert ) => {

			const target = new Color();

			parseColorConfig( target, 'hsl(120deg 50% 50%)' );
			colorClose( assert, target, new Color().setHSL( 120 / 360, 0.5, 0.5 ), 'degrees' );

			parseColorConfig( target, 'hsl(2.0943951023931953rad 100% 50%)' );
			colorClose( assert, target, new Color().setHSL( 120 / 360, 1, 0.5 ), 'radians' );

			parseColorConfig( target, 'hsl(0.5turn 100% 50%)' );
			colorClose( assert, target, new Color().setHSL( 0.5, 1, 0.5 ), 'turns' );

			parseColorConfig( target, 'hsl(133.33333333333334grad 100% 50%)' );
			colorClose( assert, target, new Color().setHSL( 120 / 360, 1, 0.5 ), 'gradians' );

			parseColorConfig( target, 'hsl(33.333333333333336% 100% 50%)' );
			colorClose( assert, target, new Color().setHSL( 120 / 360, 1, 0.5 ), 'percentage hue' );

			parseColorConfig( target, 'hsl(120 50% 50%)' );
			colorClose( assert, target, new Color().setHSL( 120 / 360, 0.5, 0.5 ), 'unitless hue defaults to degrees' );

			assert.equal( warnings.length, 0, 'no warnings for valid modern hsl' );

		} );

		QUnit.test( 'modern hsl slash alpha', ( assert ) => {

			const target = new Color();

			parseColorConfig( target, 'hsl(120deg 50% 50% / 0.25)' );
			colorClose( assert, target, new Color().setHSL( 120 / 360, 0.5, 0.5 ), 'hsl slash alpha' );
			assert.equal( warnings.length, 1, 'alpha < 1 warns' );

			warnings.length = 0;
			parseColorConfig( target, 'hsl(120deg 50% 50% / 1)' );
			assert.equal( warnings.length, 0, 'alpha 1 does not warn' );

		} );

		// CLAMPING

		QUnit.test( 'out of range rgb channels are clamped and warned', ( assert ) => {

			const target = new Color();

			parseColorConfig( target, 'rgb(300 -50 128)' );
			colorClose( assert, target, new Color().setRGB( 1, 0, 128 / 255 ), 'rgb clamped' );
			assert.equal( warnings.length, 2, 'two out of range channels each warn' );
			assert.ok( warnings.every( w => w.includes( 'ColorConfig: RGB channel' ) ), 'clamp warnings come from the parser' );

			warnings.length = 0;
			parseColorConfig( target, 'rgb(150% -10% 0%)' );
			colorClose( assert, target, new Color().setRGB( 1, 0, 0 ), 'percentage rgb clamped' );
			assert.equal( warnings.length, 2, 'percentage clamping warns' );

			warnings.length = 0;
			parseColorConfig( target, 'rgb(0 0 0 / 1.5)' );
			colorClose( assert, target, new Color().setRGB( 0, 0, 0 ), 'alpha clamped' );
			assert.equal( warnings.length, 1, 'alpha clamping warns' );

		} );

		QUnit.test( 'out of range hsl saturation/lightness are clamped and hue wraps', ( assert ) => {

			const target = new Color();

			parseColorConfig( target, 'hsl(480deg 120% -10%)' );
			colorClose( assert, target, new Color().setHSL( 480 / 360, 1, 0 ), 'hsl clamped and hue wrapped' );
			assert.equal( warnings.length, 2, 'saturation and lightness each warn' );

			const wrapped = new Color();
			parseColorConfig( wrapped, 'hsl(720deg 50% 50%)' );
			colorClose( assert, wrapped, new Color().setHSL( 0, 0.5, 0.5 ), 'hue beyond one turn wraps without warning' );

		} );

		QUnit.test( 'legacy grammar clamps rgb values like the original parser', ( assert ) => {

			const target = new Color();

			parseColorConfig( target, 'rgb(300, 255, 0)' );
			assert.equal( target.r, 1, 'legacy r clamps to 255' );
			assert.equal( target.g, 1, 'legacy g stays 255' );
			assert.equal( target.b, 0, 'legacy b stays 0' );
			assert.equal( warnings.length, 0, 'legacy clamping keeps the original (silent) behavior' );

		} );

		// NONE PLACEHOLDER AND FAILURES

		QUnit.test( 'none keeps the previous value without warning', ( assert ) => {

			const target = new Color( 0x112233 );

			parseColorConfig( target, 'none' );
			assert.equal( target.getHex(), 0x112233, 'none keeps the value' );
			assert.equal( warnings.length, 0, 'none does not warn' );

			parseColorConfig( target, '  none  ' );
			assert.equal( target.getHex(), 0x112233, 'padded none keeps the value' );

		} );

		QUnit.test( 'unrecognized modern input warns and keeps the previous value', ( assert ) => {

			const target = new Color( 0x112233 );

			parseColorConfig( target, 'rgb(255 0)' );
			assert.equal( target.getHex(), 0x112233, 'too few channels' );
			assert.equal( warnings.length, 1, 'malformed rgb warns' );

			parseColorConfig( target, 'hsl(120deg 50 50%)' );
			assert.equal( target.getHex(), 0x112233, 'hsl without percentage saturation' );
			assert.equal( warnings.length, 2, 'malformed hsl warns' );

			parseColorConfig( target, 'rgb(255 0 0 / )' );
			assert.equal( target.getHex(), 0x112233, 'empty alpha' );
			assert.equal( warnings.length, 3, 'empty alpha warns' );

			parseColorConfig( target, 'lab(50% 40 59.5)' );
			assert.equal( target.getHex(), 0x112233, 'unsupported modern color model' );
			assert.equal( warnings.length, 4, 'unknown modern model warns' );

			assert.ok( warnings[ 3 ].includes( 'Color: Unknown color model lab(50% 40 59.5)' ), 'unknown modern model wording' );

		} );

		QUnit.test( 'mixed and padded whitespace is accepted', ( assert ) => {

			const target = new Color();

			parseColorConfig( target, '  rgb( 255   128   0 )  ' );
			colorClose( assert, target, new Color().setRGB( 1, 128 / 255, 0 ), 'padded modern rgb' );

			parseColorConfig( target, 'hsl( 120deg  50% 50% / 0.5 )' );
			colorClose( assert, target, new Color().setHSL( 120 / 360, 0.5, 0.5 ), 'padded hsl with alpha' );
			assert.equal( warnings.length, 1, 'padded hsl alpha warns' );

		} );

		QUnit.test( 'parser precision matches a direct Color conversion', ( assert ) => {

			const target = new Color();

			parseColorConfig( target, 'rgb(18 52 86)' );
			const expected = new Color().setRGB( 18 / 255, 52 / 255, 86 / 255 );

			assert.ok( Math.abs( target.r - expected.r ) < eps, 'r within epsilon' );
			assert.ok( Math.abs( target.g - expected.g ) < eps, 'g within epsilon' );
			assert.ok( Math.abs( target.b - expected.b ) < eps, 'b within epsilon' );

		} );

	} );

} );
