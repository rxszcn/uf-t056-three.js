import { Color } from '../math/Color.js';
import { parseColorConfig } from './ColorConfig.js';
import { getConsoleFunction, setConsoleFunction } from '../utils.js';

/**
 * The configuration keys accepted for the three color channels. Both the long
 * design-tool names and short aliases are supported so legacy and current
 * configuration files can be mixed freely.
 */
const CHANNEL_KEYS = {
	materialColor: [ 'materialColor', 'material' ],
	backgroundColor: [ 'backgroundColor', 'background' ],
	fogColor: [ 'fogColor', 'fog' ]
};

const DEFAULT_MATERIAL_COLOR = 0xffffff;
const DEFAULT_BACKGROUND_COLOR = 0x000000;
const DEFAULT_FOG_COLOR = 0xcccccc;

/**
 * Theme configuration for a 3D scene.
 *
 * A single instance owns the three color channels consumed by the scene theme
 * system - the material base color, the scene background color and the fog
 * color - and feeds every channel through the same {@link parseColorConfig}
 * parser, so legacy comma separated values and current space separated values
 * can be mixed inside one configuration file.
 *
 * Configuration strings use one `key = value` pair per line. Lines starting
 * with `#` and empty lines are ignored:
 *
 * ```text
 * materialColor = rgb(255 128 0 / 0.9)
 * backgroundColor = #202830
 * fogColor = hsl(210deg, 30%, 60%)
 * ```
 */
class ThemeConfig {

	/**
	 * Constructs a new theme configuration.
	 *
	 * @param {(Object|string)} [config] - A configuration object or a
	 * configuration string. When omitted, the default colors are used.
	 */
	constructor( config ) {

		/**
		 * This flag can be used for type testing.
		 *
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isThemeConfig = true;

		/**
		 * The material base color.
		 *
		 * @type {Color}
		 */
		this.materialColor = new Color( DEFAULT_MATERIAL_COLOR );

		/**
		 * The scene background color.
		 *
		 * @type {Color}
		 */
		this.backgroundColor = new Color( DEFAULT_BACKGROUND_COLOR );

		/**
		 * The fog color.
		 *
		 * @type {Color}
		 */
		this.fogColor = new Color( DEFAULT_FOG_COLOR );

		/**
		 * The warnings collected while parsing the configuration.
		 *
		 * @type {Array<string>}
		 */
		this.warnings = [];

		if ( config !== undefined ) {

			this.parse( config );

		}

	}

	/**
	 * Parses the given configuration object or configuration string. Every
	 * channel is parsed independently, so an unrecognized value only keeps that
	 * channel's previous color while the other channels still update.
	 *
	 * @param {(Object|string)} config - A configuration object or a
	 * configuration string.
	 * @return {ThemeConfig} A reference to this instance.
	 */
	parse( config ) {

		const values = typeof config === 'string' ? parseConfigString( config ) : config;

		if ( values === null || typeof values !== 'object' ) {

			return this;

		}

		this.warnings = [];

		const previousConsoleFunction = getConsoleFunction();

		setConsoleFunction( ( type, ...params ) => {

			if ( type === 'warn' ) {

				this.warnings.push( params.join( ' ' ) );

			}

			if ( previousConsoleFunction ) {

				previousConsoleFunction( type, ...params );

			}

		} );

		try {

			for ( const channel of Object.keys( CHANNEL_KEYS ) ) {

				const value = findChannelValue( values, CHANNEL_KEYS[ channel ] );

				if ( value === undefined ) continue;

				if ( value === null || ( typeof value === 'string' && value.trim() === 'none' ) ) {

					// `none` is an explicit empty slot: keep the current color.
					continue;

				}

				parseColorConfig( this[ channel ], value );

			}

		} finally {

			setConsoleFunction( previousConsoleFunction );

		}

		return this;

	}

	/**
	 * Applies the three color channels to the given scene and its targets. The
	 * material color is written to each provided material, the background color
	 * to `scene.background` and the fog color to the scene's fog instance.
	 *
	 * @param {Object} scene - The scene the theme is applied to.
	 * @param {Object} [options] - The application options.
	 * @param {Array<Object>|Object} [options.materials] - A material or a list
	 * of materials receiving the material base color.
	 * @return {ThemeConfig} A reference to this instance.
	 */
	apply( scene, options = {} ) {

		const materials = options.materials === undefined
			? []
			: Array.isArray( options.materials ) ? options.materials : [ options.materials ];

		for ( const material of materials ) {

			if ( material && material.color && material.color.isColor ) {

				material.color.copy( this.materialColor );

			}

		}

		if ( scene.background === null || scene.background === undefined || scene.background.isColor ) {

			scene.background = this.backgroundColor.clone();

		}

		if ( scene.fog !== null && scene.fog !== undefined && scene.fog.color && scene.fog.color.isColor ) {

			scene.fog.color.copy( this.fogColor );

		}

		return this;

	}

}

function findChannelValue( values, keys ) {

	for ( const key of keys ) {

		if ( values[ key ] !== undefined ) return values[ key ];

	}

	return undefined;

}

function parseConfigString( config ) {

	const result = {};

	const lines = config.split( /\r?\n/ );

	for ( const line of lines ) {

		const trimmed = line.trim();

		if ( trimmed.length === 0 || trimmed.charAt( 0 ) === '#' ) continue;

		const separatorIndex = trimmed.indexOf( '=' );

		if ( separatorIndex === - 1 ) continue;

		const key = trimmed.slice( 0, separatorIndex ).trim();
		const value = trimmed.slice( separatorIndex + 1 ).trim();
		result[ key ] = value;

	}

	return result;

}

export { ThemeConfig, DEFAULT_MATERIAL_COLOR, DEFAULT_BACKGROUND_COLOR, DEFAULT_FOG_COLOR };
