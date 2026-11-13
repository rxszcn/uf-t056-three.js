import { Color } from '../../../../src/math/Color.js';
import { ColorManagement } from '../../../../src/math/ColorManagement.js';
import { SRGBColorSpace } from '../../../../src/constants.js';
import { ThemeConfig, DEFAULT_MATERIAL_COLOR, DEFAULT_BACKGROUND_COLOR, DEFAULT_FOG_COLOR } from '../../../../src/scenes/ThemeConfig.js';
import { Scene } from '../../../../src/scenes/Scene.js';
import { Fog } from '../../../../src/scenes/Fog.js';
import { FogExp2 } from '../../../../src/scenes/FogExp2.js';
import { MeshBasicMaterial } from '../../../../src/materials/MeshBasicMaterial.js';

export default QUnit.module( 'Scenes', () => {

	QUnit.module( 'ThemeConfig', () => {

		const colorManagementEnabled = ColorManagement.enabled;

		QUnit.testStart( () => {

			ColorManagement.enabled = false;

		} );

		QUnit.testDone( () => {

			ColorManagement.enabled = colorManagementEnabled;

		} );

		function srgb( r, g, b ) {

			return new Color().setRGB( r, g, b, SRGBColorSpace );

		}

		// DEFAULTS

		QUnit.test( 'default colors match the scene fallbacks', ( assert ) => {

			const theme = new ThemeConfig();

			assert.ok( theme.materialColor.equals( new Color( DEFAULT_MATERIAL_COLOR ) ), 'material default' );
			assert.ok( theme.backgroundColor.equals( new Color( DEFAULT_BACKGROUND_COLOR ) ), 'background default' );
			assert.ok( theme.fogColor.equals( new Color( DEFAULT_FOG_COLOR ) ), 'fog default' );
			assert.deepEqual( theme.warnings, [], 'no warnings by default' );

		} );

		// CONFIG OBJECT

		QUnit.test( 'parses an object with both legacy and modern grammar', ( assert ) => {

			const theme = new ThemeConfig( {
				materialColor: 'rgb(255 128 0 / 0.9)',
				backgroundColor: '#202830',
				fogColor: 'hsl(210, 30%, 60%)'
			} );

			assert.ok( theme.materialColor.equals( srgb( 1, 128 / 255, 0 ) ), 'modern rgb material color' );
			assert.ok( theme.backgroundColor.equals( new Color( 0x202830 ) ), 'legacy hex background' );
			assert.ok( theme.fogColor.equals( new Color().setHSL( 210 / 360, 0.3, 0.6, SRGBColorSpace ) ), 'legacy hsl fog' );

			assert.equal( theme.warnings.length, 1, 'only the ignored alpha warns' );
			assert.ok( theme.warnings[ 0 ].includes( 'Alpha component' ), 'alpha warning is collected' );

		} );

		QUnit.test( 'accepts short channel aliases', ( assert ) => {

			const theme = new ThemeConfig( {
				material: 'rgb(10 20 30)',
				background: 'hsl(120deg 50% 50%)',
				fog: 'red'
			} );

			assert.ok( theme.materialColor.equals( srgb( 10 / 255, 20 / 255, 30 / 255 ) ), 'material alias' );
			assert.ok( theme.backgroundColor.equals( new Color().setHSL( 120 / 360, 0.5, 0.5, SRGBColorSpace ) ), 'background alias' );
			assert.ok( theme.fogColor.equals( new Color( 0xff0000 ) ), 'fog alias' );
			assert.equal( theme.warnings.length, 0, 'no warnings' );

		} );

		// CONFIG STRING (new and old grammar mixed in one file)

		QUnit.test( 'parses a configuration string mixing both generations', ( assert ) => {

			const config = [
				'# design export - two grammars in one file',
				'',
				'materialColor = rgb(255 128 0)',
				'backgroundColor = rgb(32, 40, 48)',
				'fogColor = hsl(210deg 30% 60% / 0.7)'
			].join( '\n' );

			const theme = new ThemeConfig( config );

			assert.ok( theme.materialColor.equals( srgb( 1, 128 / 255, 0 ) ), 'modern material' );
			assert.ok( theme.backgroundColor.equals( srgb( 32 / 255, 40 / 255, 48 / 255 ) ), 'legacy background' );
			assert.ok( theme.fogColor.equals( new Color().setHSL( 210 / 360, 0.3, 0.6, SRGBColorSpace ) ), 'modern fog' );
			assert.equal( theme.warnings.length, 1, 'fog alpha warning collected' );

		} );

		// NONE AND FAILURE ISOLATION

		QUnit.test( 'none leaves a channel untouched and failures stay isolated', ( assert ) => {

			const theme = new ThemeConfig( {
				materialColor: 'rgb(1 2 3)',
				backgroundColor: 'rgb(4 5 6)',
				fogColor: 'rgb(7 8 9)'
			} );

			theme.parse( {
				materialColor: 'none',
				backgroundColor: 'not-a-valid-color',
				fogColor: 'rgb(10 20 30)'
			} );

			assert.ok( theme.materialColor.equals( srgb( 1 / 255, 2 / 255, 3 / 255 ) ), 'none keeps the material color' );
			assert.ok( theme.backgroundColor.equals( srgb( 4 / 255, 5 / 255, 6 / 255 ) ), 'failure keeps the background color' );
			assert.ok( theme.fogColor.equals( srgb( 10 / 255, 20 / 255, 30 / 255 ) ), 'valid fog still updates' );

			assert.equal( theme.warnings.length, 1, 'only the failed channel warns' );
			assert.ok( theme.warnings[ 0 ].includes( 'Color: Unknown color not-a-valid-color' ), 'warning wording' );

		} );

		QUnit.test( 'clamped channels are applied and counted as warnings', ( assert ) => {

			const theme = new ThemeConfig( {
				materialColor: 'rgb(300 0 0)',
				backgroundColor: 'hsl(120deg 150% 50%)'
			} );

			assert.ok( theme.materialColor.equals( new Color( 0xff0000 ) ), 'rgb clamps to red' );
			assert.ok( theme.backgroundColor.equals( new Color().setHSL( 120 / 360, 1, 0.5, SRGBColorSpace ) ), 'hsl saturation clamps' );
			assert.equal( theme.warnings.length, 2, 'each clamp is collected' );

		} );

		// APPLY

		QUnit.test( 'apply feeds the same colors to material, background and fog', ( assert ) => {

			const theme = new ThemeConfig( {
				materialColor: 'rgb(255 128 0)',
				backgroundColor: 'hsl(210deg 50% 25%)',
				fogColor: 'rgb(0 100 200)'
			} );

			const materialA = new MeshBasicMaterial();
			const materialB = new MeshBasicMaterial();
			const scene = new Scene();
			scene.fog = new Fog( 0xffffff );

			theme.apply( scene, { materials: [ materialA, materialB ] } );

			assert.ok( materialA.color.equals( theme.materialColor ), 'material A receives the material color' );
			assert.ok( materialB.color.equals( theme.materialColor ), 'material B receives the material color' );
			assert.ok( scene.background.isColor && scene.background.equals( theme.backgroundColor ), 'background receives the background color' );
			assert.ok( scene.fog.color.equals( theme.fogColor ), 'fog receives the fog color' );

		} );

		QUnit.test( 'apply supports a single material and FogExp2', ( assert ) => {

			const theme = new ThemeConfig( { fogColor: 'hsl(90deg 25% 75%)' } );
			const material = new MeshBasicMaterial();
			const scene = new Scene();
			scene.fog = new FogExp2( 0x000000 );

			theme.apply( scene, { materials: material } );

			assert.ok( material.color.equals( theme.materialColor ), 'single material works' );
			assert.ok( scene.fog.color.equals( theme.fogColor ), 'FogExp2 receives the fog color' );

		} );

		QUnit.test( 'apply leaves a textured background untouched', ( assert ) => {

			const theme = new ThemeConfig( { backgroundColor: 'rgb(1 2 3)' } );
			const scene = new Scene();
			const texture = {};
			scene.background = texture;

			theme.apply( scene );

			assert.strictEqual( scene.background, texture, 'non-color background is preserved' );

		} );

		// RENDERING CONSISTENCY

		QUnit.test( 'all three channels render the same value as a directly parsed Color', ( assert ) => {

			const config = {
				materialColor: 'rgb(18 52 86)',
				backgroundColor: 'hsl(209.1rad 80% 42%)',
				fogColor: '#3a6ea5'
			};

			const theme = new ThemeConfig( config );
			const scene = new Scene();
			scene.fog = new Fog();
			const material = new MeshBasicMaterial();

			theme.apply( scene, { materials: material } );

			const expectedMaterial = new Color().setStyle( 'rgb(18, 52, 86)' );
			const expectedBackground = new Color().setHSL( 209.1 / ( 2 * Math.PI ), 0.8, 0.42, SRGBColorSpace );
			const expectedFog = new Color().setStyle( '#3a6ea5' );

			assert.ok( material.color.equals( expectedMaterial ), 'material channel matches the expected color' );
			assert.ok( scene.background.equals( expectedBackground ), 'background channel matches the expected color' );
			assert.ok( scene.fog.color.equals( expectedFog ), 'fog channel matches the expected color' );

		} );

		QUnit.test( 'boundary values parse consistently across both grammars', ( assert ) => {

			const pairs = [
				[ 'rgb(0 0 0)', 'rgb(0, 0, 0)' ],
				[ 'rgb(255 255 255)', 'rgb(255, 255, 255)' ],
				[ 'rgb(0% 0% 0%)', 'rgb(0%, 0%, 0%)' ],
				[ 'rgb(100% 100% 100%)', 'rgb(100%, 100%, 100%)' ],
				[ 'hsl(0deg 0% 0%)', 'hsl(0, 0%, 0%)' ],
				[ 'hsl(360deg 100% 100%)', 'hsl(360, 100%, 100%)' ],
				[ 'hsl(0turn 0% 50%)', 'hsl(0, 0%, 50%)' ]
			];

			for ( const [ modern, legacy ] of pairs ) {

				const modernTheme = new ThemeConfig( { materialColor: modern } );
				const legacyTheme = new ThemeConfig( { materialColor: legacy } );

				assert.ok(
					modernTheme.materialColor.equals( legacyTheme.materialColor ),
					modern + ' == ' + legacy
				);

				assert.deepEqual( modernTheme.warnings, [], modern + ' produces no warnings' );
				assert.deepEqual( legacyTheme.warnings, [], legacy + ' produces no warnings' );

			}

		} );

	} );

} );
