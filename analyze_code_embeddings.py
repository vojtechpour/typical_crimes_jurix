import json
import numpy as np
from pathlib import Path
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans, AgglomerativeClustering, DBSCAN
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
import matplotlib.pyplot as plt
from collections import Counter, defaultdict
import seaborn as sns
import logging
import time

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('embedding_analysis.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
EMBEDDINGS_FILE = Path('data') / 'initial_code_embeddings.json'
OUTPUT_DIR = Path('analysis_results')

def load_embeddings():
    """Load the generated embeddings"""
    logger.info("=== Loading Embeddings ===")
    logger.info(f"Reading from: {EMBEDDINGS_FILE}")
    
    try:
        with open(EMBEDDINGS_FILE, 'r', encoding='utf8') as f:
            data = json.load(f)
        logger.info("✅ Successfully loaded embeddings file")
    except FileNotFoundError:
        logger.error(f"❌ Embeddings file not found: {EMBEDDINGS_FILE}")
        logger.error("Run generate_code_embeddings.py first to create embeddings")
        raise
    except Exception as e:
        logger.error(f"❌ Error loading embeddings: {e}")
        raise
    
    embeddings_data = data['embeddings']
    metadata = data['metadata']
    
    logger.info(f"Metadata - Model: {metadata['model']}")
    logger.info(f"Metadata - Generated at: {metadata['generated_at']}")
    logger.info(f"Metadata - Total codes: {metadata['total_codes']}")
    logger.info(f"Metadata - Embedding dimension: {metadata['embedding_dimension']}")
    
    # Extract codes, embeddings, and frequencies
    logger.info("Extracting embeddings data...")
    codes = list(embeddings_data.keys())
    embeddings = np.array([embeddings_data[code]['embedding'] for code in codes])
    frequencies = [embeddings_data[code]['frequency'] for code in codes]
    
    logger.info(f"✅ Loaded {len(codes)} codes with {embeddings.shape[1]}D embeddings")
    logger.info(f"Total frequency sum: {sum(frequencies)} (should match total cases)")
    
    return codes, embeddings, frequencies, embeddings_data

def find_optimal_clusters(embeddings, max_k=20):
    """Find optimal number of clusters using elbow method and silhouette analysis"""
    logger.info("=== Finding Optimal Number of Clusters ===")
    logger.info(f"Testing K from 2 to {max_k}")
    
    # Limit max_k if we have fewer samples
    max_k = min(max_k, len(embeddings) - 1)
    
    inertias = []
    silhouette_scores = []
    k_range = range(2, max_k + 1)
    
    for k in k_range:
        logger.info(f"Testing K={k}...")
        
        # K-means clustering
        kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(embeddings)
        
        # Calculate metrics
        inertias.append(kmeans.inertia_)
        sil_score = silhouette_score(embeddings, cluster_labels)
        silhouette_scores.append(sil_score)
        
        logger.info(f"K={k}: Inertia={kmeans.inertia_:.2f}, Silhouette={sil_score:.4f}")
    
    # Find optimal K using elbow method (biggest drop in inertia)
    inertia_diffs = np.diff(inertias)
    elbow_k = k_range[np.argmin(inertia_diffs)] + 1
    
    # Find optimal K using silhouette score (highest score)
    best_sil_idx = np.argmax(silhouette_scores)
    silhouette_k = k_range[best_sil_idx]
    
    logger.info(f"Elbow method suggests K={elbow_k}")
    logger.info(f"Silhouette method suggests K={silhouette_k} (score: {silhouette_scores[best_sil_idx]:.4f})")
    
    # Save cluster optimization plot
    create_output_directory()
    plt.figure(figsize=(12, 5))
    
    plt.subplot(1, 2, 1)
    plt.plot(k_range, inertias, 'bo-')
    plt.axvline(x=elbow_k, color='r', linestyle='--', label=f'Elbow K={elbow_k}')
    plt.xlabel('Number of Clusters (K)')
    plt.ylabel('Inertia')
    plt.title('Elbow Method for Optimal K')
    plt.legend()
    plt.grid(True)
    
    plt.subplot(1, 2, 2)
    plt.plot(k_range, silhouette_scores, 'go-')
    plt.axvline(x=silhouette_k, color='r', linestyle='--', label=f'Best K={silhouette_k}')
    plt.xlabel('Number of Clusters (K)')
    plt.ylabel('Silhouette Score')
    plt.title('Silhouette Analysis for Optimal K')
    plt.legend()
    plt.grid(True)
    
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / 'cluster_optimization.png', dpi=300, bbox_inches='tight')
    plt.close()
    
    logger.info(f"✅ Cluster optimization plot saved to: {OUTPUT_DIR / 'cluster_optimization.png'}")
    
    # Return the silhouette-based optimal K (generally more reliable)
    return silhouette_k, silhouette_scores[best_sil_idx]

def perform_multiple_clustering(codes, embeddings, optimal_k):
    """Perform clustering with multiple algorithms"""
    logger.info("=== Performing Multiple Clustering Algorithms ===")
    
    clustering_results = {}
    
    # 1. K-Means (optimized)
    logger.info(f"1. K-Means clustering (K={optimal_k})...")
    kmeans = KMeans(n_clusters=optimal_k, random_state=42, n_init=10)
    kmeans_labels = kmeans.fit_predict(embeddings)
    kmeans_silhouette = silhouette_score(embeddings, kmeans_labels)
    
    clustering_results['kmeans'] = {
        'labels': kmeans_labels,
        'silhouette_score': kmeans_silhouette,
        'n_clusters': optimal_k
    }
    logger.info(f"K-Means silhouette score: {kmeans_silhouette:.4f}")
    
    # 2. Hierarchical Clustering
    logger.info(f"2. Hierarchical clustering (K={optimal_k})...")
    hierarchical = AgglomerativeClustering(n_clusters=optimal_k, linkage='ward')
    hierarchical_labels = hierarchical.fit_predict(embeddings)
    hierarchical_silhouette = silhouette_score(embeddings, hierarchical_labels)
    
    clustering_results['hierarchical'] = {
        'labels': hierarchical_labels,
        'silhouette_score': hierarchical_silhouette,
        'n_clusters': optimal_k
    }
    logger.info(f"Hierarchical silhouette score: {hierarchical_silhouette:.4f}")
    
    # 3. DBSCAN (density-based, finds optimal clusters automatically)
    logger.info("3. DBSCAN clustering (automatic cluster detection)...")
    
    # Try different eps values to find good clustering
    best_dbscan_score = -1
    best_dbscan_labels = None
    best_eps = None
    
    for eps in [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4]:
        dbscan = DBSCAN(eps=eps, min_samples=3, metric='cosine')
        dbscan_labels = dbscan.fit_predict(embeddings)
        
        # Check if we got meaningful clusters (not all noise or single cluster)
        n_clusters = len(set(dbscan_labels)) - (1 if -1 in dbscan_labels else 0)
        n_noise = list(dbscan_labels).count(-1)
        
        if n_clusters > 1 and n_noise < len(embeddings) * 0.5:  # Less than 50% noise
            dbscan_silhouette = silhouette_score(embeddings, dbscan_labels)
            if dbscan_silhouette > best_dbscan_score:
                best_dbscan_score = dbscan_silhouette
                best_dbscan_labels = dbscan_labels
                best_eps = eps
        
        logger.info(f"DBSCAN eps={eps}: {n_clusters} clusters, {n_noise} noise points")
    
    if best_dbscan_labels is not None:
        n_clusters_dbscan = len(set(best_dbscan_labels)) - (1 if -1 in best_dbscan_labels else 0)
        clustering_results['dbscan'] = {
            'labels': best_dbscan_labels,
            'silhouette_score': best_dbscan_score,
            'n_clusters': n_clusters_dbscan,
            'eps': best_eps
        }
        logger.info(f"Best DBSCAN silhouette score: {best_dbscan_score:.4f} (eps={best_eps}, {n_clusters_dbscan} clusters)")
    else:
        logger.warning("DBSCAN failed to find meaningful clusters")
    
    # Choose best clustering method
    best_method = max(clustering_results.keys(), key=lambda x: clustering_results[x]['silhouette_score'])
    logger.info(f"✅ Best clustering method: {best_method} (silhouette: {clustering_results[best_method]['silhouette_score']:.4f})")
    
    return clustering_results, best_method

def analyze_cluster_quality(embeddings, cluster_labels, method_name):
    """Analyze the quality of clustering using multiple metrics"""
    logger.info(f"=== Analyzing Cluster Quality for {method_name.upper()} ===")
    
    # Remove noise points for DBSCAN (-1 labels)
    valid_mask = cluster_labels != -1
    valid_embeddings = embeddings[valid_mask]
    valid_labels = cluster_labels[valid_mask]
    
    if len(set(valid_labels)) < 2:
        logger.warning(f"Not enough clusters for quality analysis in {method_name}")
        return {}
    
    # Calculate multiple clustering quality metrics
    silhouette = silhouette_score(valid_embeddings, valid_labels)
    calinski_harabasz = calinski_harabasz_score(valid_embeddings, valid_labels)
    davies_bouldin = davies_bouldin_score(valid_embeddings, valid_labels)
    
    quality_metrics = {
        'silhouette_score': silhouette,
        'calinski_harabasz_score': calinski_harabasz,
        'davies_bouldin_score': davies_bouldin
    }
    
    logger.info(f"Silhouette Score: {silhouette:.4f} (higher is better, range: -1 to 1)")
    logger.info(f"Calinski-Harabasz Score: {calinski_harabasz:.2f} (higher is better)")
    logger.info(f"Davies-Bouldin Score: {davies_bouldin:.4f} (lower is better)")
    
    return quality_metrics

def visualize_clusters_2d(codes, embeddings, clustering_results, frequencies):
    """Create 2D visualizations of clusters using PCA and t-SNE"""
    logger.info("=== Creating 2D Cluster Visualizations ===")
    
    create_output_directory()
    
    # Reduce dimensionality for visualization
    logger.info("Computing PCA reduction...")
    pca = PCA(n_components=2, random_state=42)
    embeddings_pca = pca.fit_transform(embeddings)
    
    logger.info("Computing t-SNE reduction...")
    tsne = TSNE(n_components=2, random_state=42, perplexity=min(30, len(embeddings)-1))
    embeddings_tsne = tsne.fit_transform(embeddings)
    
    # Create visualization for each clustering method
    for method_name, results in clustering_results.items():
        logger.info(f"Creating visualization for {method_name}...")
        
        labels = results['labels']
        n_clusters = results['n_clusters']
        
        fig, axes = plt.subplots(1, 2, figsize=(16, 6))
        
        # PCA plot
        scatter = axes[0].scatter(embeddings_pca[:, 0], embeddings_pca[:, 1], 
                                c=labels, cmap='tab20', alpha=0.7, s=50)
        axes[0].set_title(f'{method_name.upper()} Clustering - PCA\n'
                         f'{n_clusters} clusters, Silhouette: {results["silhouette_score"]:.3f}')
        axes[0].set_xlabel(f'PC1 ({pca.explained_variance_ratio_[0]:.1%} variance)')
        axes[0].set_ylabel(f'PC2 ({pca.explained_variance_ratio_[1]:.1%} variance)')
        
        # t-SNE plot
        scatter = axes[1].scatter(embeddings_tsne[:, 0], embeddings_tsne[:, 1], 
                                c=labels, cmap='tab20', alpha=0.7, s=50)
        axes[1].set_title(f'{method_name.upper()} Clustering - t-SNE\n'
                         f'{n_clusters} clusters, Silhouette: {results["silhouette_score"]:.3f}')
        axes[1].set_xlabel('t-SNE 1')
        axes[1].set_ylabel('t-SNE 2')
        
        plt.tight_layout()
        plt.savefig(OUTPUT_DIR / f'clusters_{method_name}.png', dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"✅ Saved visualization: {OUTPUT_DIR / f'clusters_{method_name}.png'}")

def analyze_detailed_clusters(codes, frequencies, cluster_labels, method_name):
    """Provide detailed analysis of each cluster"""
    logger.info(f"=== Detailed Cluster Analysis for {method_name.upper()} ===")
    
    # Group codes by cluster
    clusters = defaultdict(list)
    cluster_frequencies = defaultdict(list)
    
    for i, label in enumerate(cluster_labels):
        clusters[label].append(codes[i])
        cluster_frequencies[label].append(frequencies[i])
    
    # Analyze each cluster
    cluster_analysis = {}
    for cluster_id in sorted(clusters.keys()):
        if cluster_id == -1:  # Skip noise cluster for DBSCAN
            continue
            
        cluster_codes = clusters[cluster_id]
        cluster_freqs = cluster_frequencies[cluster_id]
        
        analysis = {
            'size': len(cluster_codes),
            'total_frequency': sum(cluster_freqs),
            'avg_frequency': np.mean(cluster_freqs),
            'most_frequent_code': cluster_codes[np.argmax(cluster_freqs)],
            'max_frequency': max(cluster_freqs)
        }
        
        cluster_analysis[cluster_id] = analysis
        
        logger.info(f"\n--- Cluster {cluster_id} ---")
        logger.info(f"Size: {analysis['size']} codes")
        logger.info(f"Total frequency: {analysis['total_frequency']} cases")
        logger.info(f"Avg frequency: {analysis['avg_frequency']:.2f} cases per code")
        logger.info(f"Most frequent code ({analysis['max_frequency']} cases): {analysis['most_frequent_code'][:100]}{'...' if len(analysis['most_frequent_code']) > 100 else ''}")
        
        # Show sample codes from cluster
        logger.info("Sample codes:")
        for i, code in enumerate(cluster_codes[:3]):
            logger.info(f"  {code[:120]}{'...' if len(code) > 120 else ''}")
        if len(cluster_codes) > 3:
            logger.info(f"  ... and {len(cluster_codes) - 3} more codes")
    
    # Handle noise cluster for DBSCAN
    if -1 in clusters:
        noise_codes = clusters[-1]
        logger.info(f"\n--- Noise Points (DBSCAN) ---")
        logger.info(f"Size: {len(noise_codes)} codes")
        logger.info("Sample noise codes:")
        for code in noise_codes[:3]:
            logger.info(f"  {code[:120]}{'...' if len(code) > 120 else ''}")
    
    return cluster_analysis

def calculate_similarity_matrix(embeddings):
    """Calculate cosine similarity matrix between all codes"""
    logger.info("=== Calculating Similarity Matrix ===")
    n_codes = len(embeddings)
    total_pairs = (n_codes * (n_codes - 1)) // 2
    
    logger.info(f"Computing similarities for {n_codes} codes")
    logger.info(f"Total unique pairs: {total_pairs:,}")
    
    start_time = time.time()
    similarity_matrix = cosine_similarity(embeddings)
    elapsed_time = time.time() - start_time
    
    logger.info(f"✅ Similarity matrix computed in {elapsed_time:.2f} seconds")
    logger.info(f"Matrix shape: {similarity_matrix.shape}")
    
    return similarity_matrix

def find_most_similar_pairs(codes, similarity_matrix, top_n=20):
    """Find the most similar pairs of codes"""
    logger.info(f"=== Finding Top {top_n} Most Similar Code Pairs ===")
    
    similar_pairs = []
    n = len(codes)
    processed_pairs = 0
    total_pairs = (n * (n - 1)) // 2
    
    logger.info("Extracting similarity scores from matrix...")
    
    for i in range(n):
        for j in range(i+1, n):
            similarity = similarity_matrix[i][j]
            similar_pairs.append((similarity, codes[i], codes[j]))
            processed_pairs += 1
            
            if processed_pairs % 10000 == 0:
                logger.info(f"Processed {processed_pairs:,}/{total_pairs:,} pairs ({processed_pairs/total_pairs*100:.1f}%)")
    
    logger.info("Sorting pairs by similarity...")
    # Sort by similarity (descending)
    similar_pairs.sort(reverse=True)
    
    logger.info(f"\n=== TOP {top_n} MOST SIMILAR CODE PAIRS ===")
    for rank, (similarity, code1, code2) in enumerate(similar_pairs[:top_n], 1):
        logger.info(f"{rank:2d}. Similarity: {similarity:.4f}")
        logger.info(f"    Code 1: {code1[:80]}{'...' if len(code1) > 80 else ''}")
        logger.info(f"    Code 2: {code2[:80]}{'...' if len(code2) > 80 else ''}")
        logger.info("")
    
    logger.info(f"✅ Found and ranked {len(similar_pairs):,} similar pairs")
    return similar_pairs

def find_least_similar_pairs(codes, similarity_matrix, bottom_n=10):
    """Find the least similar pairs of codes"""
    logger.info(f"=== Finding Bottom {bottom_n} Least Similar Code Pairs ===")
    
    similar_pairs = []
    n = len(codes)
    
    logger.info("Extracting pairs for least similar analysis...")
    for i in range(n):
        for j in range(i+1, n):
            similarity = similarity_matrix[i][j]
            similar_pairs.append((similarity, codes[i], codes[j]))
    
    # Sort by similarity (ascending)
    similar_pairs.sort()
    
    logger.info(f"\n=== BOTTOM {bottom_n} LEAST SIMILAR CODE PAIRS ===")
    for rank, (similarity, code1, code2) in enumerate(similar_pairs[:bottom_n], 1):
        logger.info(f"{rank:2d}. Similarity: {similarity:.4f}")
        logger.info(f"    Code 1: {code1[:80]}{'...' if len(code1) > 80 else ''}")
        logger.info(f"    Code 2: {code2[:80]}{'...' if len(code2) > 80 else ''}")
        logger.info("")

def analyze_similarity_distribution(similarity_matrix):
    """Analyze the distribution of similarity scores"""
    logger.info("=== Analyzing Similarity Distribution ===")
    
    # Get upper triangle (excluding diagonal)
    n = similarity_matrix.shape[0]
    similarities = []
    
    logger.info("Extracting upper triangle similarities (excluding diagonal)...")
    for i in range(n):
        for j in range(i+1, n):
            similarities.append(similarity_matrix[i][j])
    
    similarities = np.array(similarities)
    
    logger.info(f"\n=== SIMILARITY DISTRIBUTION ANALYSIS ===")
    logger.info(f"Total pairs: {len(similarities):,}")
    logger.info(f"Mean similarity: {np.mean(similarities):.4f}")
    logger.info(f"Median similarity: {np.median(similarities):.4f}")
    logger.info(f"Std deviation: {np.std(similarities):.4f}")
    logger.info(f"Min similarity: {np.min(similarities):.4f}")
    logger.info(f"Max similarity: {np.max(similarities):.4f}")
    
    # Percentiles
    percentiles = [90, 95, 99]
    for p in percentiles:
        val = np.percentile(similarities, p)
        logger.info(f"{p}th percentile: {val:.4f}")
    
    logger.info("✅ Similarity distribution analysis complete")
    return similarities

def find_outliers(codes, embeddings, threshold_percentile=5):
    """Find codes that are outliers (least similar to others)"""
    logger.info(f"=== Finding Outliers (bottom {threshold_percentile}%) ===")
    
    logger.info("Calculating similarity matrix for outlier detection...")
    similarity_matrix = cosine_similarity(embeddings)
    
    # Calculate average similarity for each code
    logger.info("Calculating average similarity for each code...")
    avg_similarities = []
    for i in range(len(codes)):
        if i % 50 == 0:
            logger.info(f"Processing code {i+1}/{len(codes)}")
        
        # Exclude self-similarity
        similarities = np.concatenate([similarity_matrix[i][:i], similarity_matrix[i][i+1:]])
        avg_similarities.append(np.mean(similarities))
    
    # Find outliers (codes with lowest average similarity)
    threshold = np.percentile(avg_similarities, threshold_percentile)
    outliers = [(avg_similarities[i], codes[i]) for i in range(len(codes)) 
               if avg_similarities[i] <= threshold]
    
    outliers.sort()  # Sort by avg similarity (ascending)
    
    logger.info(f"\n=== OUTLIER ANALYSIS ===")
    logger.info(f"Threshold (bottom {threshold_percentile}%): {threshold:.4f}")
    logger.info(f"Found {len(outliers)} outlier codes:")
    
    for avg_sim, code in outliers:
        logger.info(f"  Avg similarity: {avg_sim:.4f} | {code[:100]}{'...' if len(code) > 100 else ''}")
    
    logger.info("✅ Outlier analysis complete")

def analyze_by_frequency(codes, frequencies, embeddings):
    """Analyze codes by their frequency"""
    logger.info("=== Analyzing Codes by Frequency ===")
    
    freq_counter = Counter(frequencies)
    logger.info(f"Frequency distribution (top 10):")
    for freq in sorted(freq_counter.keys(), reverse=True)[:10]:
        count = freq_counter[freq]
        logger.info(f"  {freq} cases: {count} codes")
    
    # Most frequent codes
    logger.info(f"\n=== TOP 10 MOST FREQUENT CODES ===")
    freq_code_pairs = list(zip(frequencies, codes))
    freq_code_pairs.sort(reverse=True)
    
    for i, (freq, code) in enumerate(freq_code_pairs[:10]):
        logger.info(f"{i+1:2d}. ({freq:2d} cases) {code[:80]}{'...' if len(code) > 80 else ''}")
    
    logger.info("✅ Frequency analysis complete")

def create_output_directory():
    """Create output directory for analysis results"""
    logger.info(f"Creating output directory: {OUTPUT_DIR}")
    OUTPUT_DIR.mkdir(exist_ok=True)
    logger.info("✅ Output directory ready")

def save_comprehensive_analysis(codes, similarity_matrix, similar_pairs, clustering_results, best_method):
    """Save comprehensive analysis results to file"""
    logger.info("=== Saving Comprehensive Analysis Results ===")
    create_output_directory()
    
    output_file = OUTPUT_DIR / 'comprehensive_analysis.json'
    logger.info(f"Saving comprehensive analysis to: {output_file}")
    
    # Prepare clustering results for JSON
    clustering_summary = {}
    for method, results in clustering_results.items():
        clustering_summary[method] = {
            'n_clusters': int(results['n_clusters']),
            'silhouette_score': float(results['silhouette_score']),
            'cluster_sizes': [int(np.sum(results['labels'] == i)) 
                            for i in range(results['n_clusters'])]
        }
        if 'eps' in results:
            clustering_summary[method]['eps'] = float(results['eps'])
    
    # Prepare data for JSON serialization
    analysis_data = {
        'metadata': {
            'total_codes': len(codes),
            'total_pairs': len(similar_pairs),
            'analysis_date': str(np.datetime64('now')),
            'best_clustering_method': best_method
        },
        'clustering_results': clustering_summary,
        'top_similar_pairs': [
            {
                'similarity': float(sim),
                'code1': code1,
                'code2': code2
            }
            for sim, code1, code2 in similar_pairs[:50]  # Top 50
        ],
        'similarity_stats': {
            'mean': float(np.mean(similarity_matrix)),
            'std': float(np.std(similarity_matrix)),
            'min': float(np.min(similarity_matrix)),
            'max': float(np.max(similarity_matrix))
        }
    }
    
    with open(output_file, 'w', encoding='utf8') as f:
        json.dump(analysis_data, f, indent=2, ensure_ascii=False)
    
    logger.info(f"✅ Comprehensive analysis saved to: {output_file}")

def main():
    logger.info("=== STARTING ENHANCED EMBEDDING ANALYSIS ===")
    start_time = time.time()
    
    try:
        # Load data
        codes, embeddings, frequencies, embeddings_data = load_embeddings()
        
        # Find optimal number of clusters
        optimal_k, best_silhouette = find_optimal_clusters(embeddings)
        
        # Perform multiple clustering approaches
        clustering_results, best_method = perform_multiple_clustering(codes, embeddings, optimal_k)
        
        # Analyze cluster quality for each method
        for method_name, results in clustering_results.items():
            quality_metrics = analyze_cluster_quality(embeddings, results['labels'], method_name)
            results.update(quality_metrics)
        
        # Create 2D visualizations
        visualize_clusters_2d(codes, embeddings, clustering_results, frequencies)
        
        # Detailed cluster analysis for best method
        best_labels = clustering_results[best_method]['labels']
        cluster_analysis = analyze_detailed_clusters(codes, frequencies, best_labels, best_method)
        
        # Calculate similarities
        similarity_matrix = calculate_similarity_matrix(embeddings)
        
        # Find most and least similar pairs
        similar_pairs = find_most_similar_pairs(codes, similarity_matrix)
        find_least_similar_pairs(codes, similarity_matrix)
        
        # Analyze similarity distribution
        similarities = analyze_similarity_distribution(similarity_matrix)
        
        # Find outliers
        find_outliers(codes, embeddings)
        
        # Analyze by frequency
        analyze_by_frequency(codes, frequencies, embeddings)
        
        # Save comprehensive results
        save_comprehensive_analysis(codes, similarity_matrix, similar_pairs, clustering_results, best_method)
        
        total_time = time.time() - start_time
        logger.info("=== ENHANCED ANALYSIS COMPLETE ===")
        logger.info(f"Total analysis time: {total_time:.2f} seconds")
        logger.info(f"Optimal clusters: {optimal_k} (silhouette: {best_silhouette:.4f})")
        logger.info(f"Best clustering method: {best_method}")
        logger.info("Generated files:")
        logger.info(f"  - embedding_analysis.log")
        logger.info(f"  - {OUTPUT_DIR}/cluster_optimization.png")
        logger.info(f"  - {OUTPUT_DIR}/clusters_*.png (for each method)")
        logger.info(f"  - {OUTPUT_DIR}/comprehensive_analysis.json")
        logger.info("")
        logger.info("Key insights:")
        logger.info("1. Review cluster optimization plots to validate K selection")
        logger.info("2. Compare clustering methods using silhouette scores")
        logger.info("3. Examine 2D visualizations for cluster structure")
        logger.info("4. Use detailed cluster analysis to understand thematic groupings")
        
    except Exception as e:
        logger.error(f"❌ Enhanced analysis failed: {e}")
        raise

if __name__ == "__main__":
    main() 