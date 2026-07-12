import urllib.request
import zipfile
import io
import geopandas as gpd
import topojson as tp
import os

def main():
    print('Downloading ne_50m_admin_1...')
    url = 'https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_1_states_provinces.zip'
    response = urllib.request.urlopen(url)
    with zipfile.ZipFile(io.BytesIO(response.read())) as zip_file:
        zip_file.extractall('data/ne_50m_admin_1')
    print('Extracted to data/ne_50m_admin_1')

    gdf = gpd.read_file('data/ne_50m_admin_1/ne_50m_admin_1_states_provinces.shp')
    print('Read shapefile, shape:', gdf.shape)

    # Keep only necessary columns to reduce file size
    cols_to_keep = ['adm1_code', 'iso_a2', 'name', 'name_alt', 'name_local', 'type_en', 'geometry']
    gdf = gdf[cols_to_keep]

    out_geojson = 'data/ne_50m_admin_1.geojson'
    gdf.to_file(out_geojson, driver='GeoJSON')
    print('Saved GeoJSON to', out_geojson)

    # Convert to TopoJSON using topojson python library
    print('Converting to TopoJSON...')
    topo = tp.Topology(gdf, prequantize=False)
    # Simplify the topojson a bit to reduce file size further, keeping it usable for 50m
    topo = topo.toposimplify(0.01).topoquantize(1e5)
    
    out_topojson = 'src/data/world-regions-50m.json'
    os.makedirs(os.path.dirname(out_topojson), exist_ok=True)
    topo.to_json(out_topojson)
    print('Saved TopoJSON to', out_topojson)

if __name__ == '__main__':
    main()
