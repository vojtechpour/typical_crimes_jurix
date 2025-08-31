import streamlit as st
import json
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from collections import Counter
import re
from streamlit_agraph import agraph, Node, Edge, Config
import copy
from streamlit_sortables import sort_items

# Page configuration
st.set_page_config(
    page_title="Crime Themes Explorer",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state for theme modifications
if 'modified_themes' not in st.session_state:
    st.session_state.modified_themes = None
if 'original_themes' not in st.session_state:
    st.session_state.original_themes = None
if 'changes_log' not in st.session_state:
    st.session_state.changes_log = []
if 'last_sortable_state' not in st.session_state:
    st.session_state.last_sortable_state = None
if 'reset_counter' not in st.session_state:
    st.session_state.reset_counter = 0

# Load the themes data
@st.cache_data
def load_themes_data():
    try:
        with open('data/kradeze_pripady_3b.json', 'r', encoding='utf-8') as f:
            themes_data = json.load(f)
        return themes_data
    except FileNotFoundError:
        st.error("Could not find data/kradeze_pripady_3b.json file. Please make sure the file exists.")
        return {}

# Load the crime cases data
@st.cache_data
def load_cases_data():
    try:
        with open('data/kradeze_pripady_backup_20250609_151815 copy.json', 'r', encoding='utf-8') as f:
            cases_data = json.load(f)
        return cases_data
    except FileNotFoundError:
        st.error("Could not find the crime cases backup file. Please make sure the file exists.")
        return {}

def main():
    st.title("🔍 Crime Themes Analysis Dashboard")
    st.markdown("---")
    
    # Load data
    themes_data = load_themes_data()
    cases_data = load_cases_data()
    
    if not themes_data:
        return
    
    # Initialize session state with original data
    if st.session_state.original_themes is None:
        st.session_state.original_themes = copy.deepcopy(themes_data)
        st.session_state.modified_themes = copy.deepcopy(themes_data)
    
    # Sidebar
    st.sidebar.title("Navigation")
    page = st.sidebar.selectbox(
        "Choose a view:",
        ["Overview", "Theme Explorer", "Statistics", "Search & Filter", "Case Browser", "AI vs Human Comparison", "Interactive Mind Map"]
    )
    
    if page == "Overview":
        show_overview(themes_data)
    elif page == "Theme Explorer":
        show_theme_explorer(themes_data)
    elif page == "Statistics":
        show_statistics(themes_data)
    elif page == "Search & Filter":
        show_search_filter(themes_data)
    elif page == "Case Browser":
        show_case_browser(cases_data, themes_data)
    elif page == "AI vs Human Comparison":
        show_ai_human_comparison(cases_data, themes_data)
    elif page == "Interactive Mind Map":
        show_interactive_mind_map()

def create_graph_data(themes_data):
    nodes = []
    edges = []
    
    # Color scheme for themes
    theme_colors = {
        "Workplace Theft": "#FF6B6B",
        "Shoplifting": "#4ECDC4", 
        "Theft from Vehicles": "#45B7D1",
        "Residential Burglary": "#96CEB4",
        "Commercial Burglary": "#FFEAA7",
        "Street Theft": "#DDA0DD",
        "Utility Theft": "#98D8C8",
        "Family Theft": "#F7DC6F",
        "Pickpocketing": "#BB8FCE",
        "Vandalism": "#F8C471",
        "Collaborative Shoplifting": "#85C1E9",
        "Serial Theft": "#F1948A",
        "Miscellaneous Theft": "#D5DBDB",
        "Financial Theft": "#82E0AA",
        "Vehicle Specific Theft": "#F9E79F",
        "Business Specific Theft": "#D2B4DE",
        "Gas and Fuel Theft": "#AED6F1"
    }
    
    # Create main theme nodes (Level 1)
    for i, (theme, sub_themes) in enumerate(themes_data.items()):
        color = theme_colors.get(theme, "#BDC3C7")
        nodes.append(Node(
            id=f"theme_{theme}",
            label=theme,
            size=400 + len(sub_themes) * 5,  # Size based on number of sub-themes
            color=color,
            font={"size": 16, "color": "#2C3E50"},
            shape="dot"
        ))
    
    # Create sub-theme nodes (Level 2)
    for theme, sub_themes in themes_data.items():
        for j, sub_theme in enumerate(sub_themes):
            nodes.append(Node(
                id=f"sub_{theme}_{j}",
                label=sub_theme[:30] + "..." if len(sub_theme) > 30 else sub_theme,
                size=150,
                color="#ECF0F1",
                font={"size": 10, "color": "#34495E"},
                shape="dot"
            ))
            
            # Create edge from theme to sub-theme
            edges.append(Edge(
                source=f"theme_{theme}",
                target=f"sub_{theme}_{j}",
                color="#BDC3C7",
                width=2
            ))
    
    return nodes, edges

def show_interactive_mind_map():
    st.header("🗂️ Drag & Drop Theme Reorganizer")
    
    # Theme selection dropdowns first
    theme_names = list(st.session_state.modified_themes.keys())
    
    col1, col2 = st.columns(2)
    
    with col1:
        left_theme = st.selectbox(
            "📂 Left Container - Select Theme:",
            theme_names,
            key="left_theme_selector",
            index=0
        )
    
    with col2:
        # Filter out the left theme from right theme options
        right_theme_options = [theme for theme in theme_names if theme != left_theme]
        right_theme = st.selectbox(
            "📂 Right Container - Select Theme:",
            right_theme_options,
            key="right_theme_selector",
            index=0 if right_theme_options else None
        )
    
    if not right_theme:
        st.warning("Please ensure you have at least 2 different themes to work with.")
        return
    
    # Prepare the two-container structure for drag & drop
    left_items = []
    right_items = []
    
    # Left container items
    for i, sub_theme in enumerate(st.session_state.modified_themes[left_theme]):
        item_id = f"{sub_theme}|||{left_theme}|||{i}"
        left_items.append(item_id)
    
    # Right container items
    for i, sub_theme in enumerate(st.session_state.modified_themes[right_theme]):
        item_id = f"{sub_theme}|||{right_theme}|||{i}"
        right_items.append(item_id)
    
    # Calculate change indicators helper function
    def get_change_indicator(theme_name, current_count):
        original_count = len(st.session_state.original_themes[theme_name])
        change = current_count - original_count
        if change > 0:
            return f"🟢 (+{change})"
        elif change < 0:
            return f"🔴 ({change})"
        else:
            return "⚪"
    
    # Create the two-container structure
    containers = [
        {
            'header': f"Left Container - {left_theme}",
            'items': left_items
        },
        {
            'header': f"Right Container - {right_theme}",
            'items': right_items
        }
    ]
    
    # Use multi-container sortables
    try:
        sorted_containers = sort_items(
            containers,
            multi_containers=True,
            direction="vertical",
            key=f"two_container_sortable_{left_theme}_{right_theme}_{st.session_state.reset_counter}"
        )
        
        # Check if anything changed and update accordingly
        if sorted_containers != containers:
            handle_two_container_change(sorted_containers, containers, left_theme, right_theme)
    
    except Exception as e:
        st.error(f"Sorting error: {e}")
        sorted_containers = containers
    
    # Control panel AFTER sortable operation to get current changes count
    st.markdown("---")
    col1, col2, col3 = st.columns([3, 1, 1])
    
    with col1:
        st.info("💡 **How to use:** Drag sub-themes from one container to the other to move them between categories!")
    
    with col2:
        if st.button("🔄 Reset All", type="secondary"):
            st.session_state.modified_themes = copy.deepcopy(st.session_state.original_themes)
            st.session_state.changes_log = []
            st.session_state.last_sortable_state = None
            st.session_state.reset_counter += 1
            st.success("Reset to original themes!")
            st.rerun()
    
    with col3:
        changes_count = len(st.session_state.changes_log)
        st.metric("Changes", changes_count)
    
    # Debug section (can be commented out later)
    if st.sidebar.checkbox("🐛 Debug Mode", value=False):
        st.sidebar.subheader("Debug Info")
        st.sidebar.write("**Current themes counts:**")
        for theme_name, sub_themes in st.session_state.modified_themes.items():
            original_count = len(st.session_state.original_themes[theme_name])
            current_count = len(sub_themes)
            change = current_count - original_count
            st.sidebar.write(f"{theme_name}: {current_count} ({'+'+ str(change) if change > 0 else change})")
        
        st.sidebar.write("**Recent changes:**")
        for change in st.session_state.changes_log[-3:]:
            if change['action'] == 'move':
                st.sidebar.write(f"Move: {change['sub_theme'][:20]}... from {change['from']} to {change['to']}")
            elif change['action'] == 'reorder':
                st.sidebar.write(f"Reorder in {change['theme']}")
    
    # Calculate indicators based on CURRENT state (after potential changes)
    current_left_count = len(sorted_containers[0]['items'])
    current_right_count = len(sorted_containers[1]['items'])
    
    left_indicator = get_change_indicator(left_theme, current_left_count)
    right_indicator = get_change_indicator(right_theme, current_right_count)
    
    # Display current state summary with updated indicators
    st.subheader("📊 Current State")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.write(f"**{left_indicator} {left_theme} ({current_left_count} items)**")
        if sorted_containers[0]['items']:
            for item_id in sorted_containers[0]['items']:
                sub_theme_text = item_id.split('|||')[0]
                display_text = sub_theme_text[:50] + "..." if len(sub_theme_text) > 50 else sub_theme_text
                st.write(f"• {display_text}")
        else:
            st.write("*No items - drag items here*")
    
    with col2:
        st.write(f"**{right_indicator} {right_theme} ({current_right_count} items)**")
        if sorted_containers[1]['items']:
            for item_id in sorted_containers[1]['items']:
                sub_theme_text = item_id.split('|||')[0]
                display_text = sub_theme_text[:50] + "..." if len(sub_theme_text) > 50 else sub_theme_text
                st.write(f"• {display_text}")
        else:
            st.write("*No items - drag items here*")
    
    # Quick theme switch buttons
    st.markdown("---")
    st.subheader("🔄 Quick Theme Selection")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        if st.button("🔀 Swap Themes"):
            # Swap the selected themes
            st.session_state.left_theme_selector = right_theme
            st.session_state.right_theme_selector = left_theme
            st.rerun()
    
    with col2:
        new_theme = st.selectbox(
            "Quick select for left:",
            [""] + theme_names,
            key="quick_left"
        )
        if new_theme and new_theme != left_theme:
            st.session_state.left_theme_selector = new_theme
            st.rerun()
    
    with col3:
        available_for_right = [theme for theme in theme_names if theme != (st.session_state.get('quick_left') or left_theme)]
        new_right_theme = st.selectbox(
            "Quick select for right:",
            [""] + available_for_right,
            key="quick_right"
        )
        if new_right_theme and new_right_theme != right_theme:
            st.session_state.right_theme_selector = new_right_theme
            st.rerun()
    
    # Changes section
    if st.session_state.changes_log:
        st.markdown("---")
        st.subheader("📝 Recent Changes")
        
        # Show last 3 changes
        recent_changes = st.session_state.changes_log[-3:]
        
        for i, change in enumerate(reversed(recent_changes)):
            col1, col2, col3 = st.columns([4, 1, 1])
            
            with col1:
                if change['action'] == 'move':
                    st.write(f"**{change['sub_theme'][:50]}{'...' if len(change['sub_theme']) > 50 else ''}**")
                    st.caption(f"{change['from']} → {change['to']} at {change['timestamp']}")
                elif change['action'] == 'reorder':
                    st.write(f"**Reordered items in {change['theme']}**")
                    st.caption(f"at {change['timestamp']}")
            
            with col2:
                if st.button(f"↩️ Undo", key=f"undo_recent_{len(st.session_state.changes_log) - i}"):
                    undo_change(change)
                    st.rerun()
            
            with col3:
                pass  # Empty for spacing
        
        # Action buttons
        col1, col2, col3 = st.columns(3)
        
        with col1:
            if st.button("📊 View All Changes"):
                st.session_state.show_all_changes = not getattr(st.session_state, 'show_all_changes', False)
                st.rerun()
        
        with col2:
            if st.button("💾 Export Themes"):
                export_modified_themes()
        
        with col3:
            if len(st.session_state.changes_log) > 1:
                if st.button("↩️ Undo Last"):
                    if st.session_state.changes_log:
                        last_change = st.session_state.changes_log[-1]
                        undo_change(last_change)
                        st.rerun()
        
        # Show all changes if requested
        if getattr(st.session_state, 'show_all_changes', False):
            st.subheader("🗂️ Complete Changes History")
            
            if st.session_state.changes_log:
                # Create a display-friendly version of changes
                display_changes = []
                for change in st.session_state.changes_log:
                    if change['action'] == 'move':
                        display_changes.append({
                            'Time': change['timestamp'],
                            'Action': 'Move',
                            'Sub-theme': change['sub_theme'][:40] + "..." if len(change['sub_theme']) > 40 else change['sub_theme'],
                            'From': change['from'],
                            'To': change['to']
                        })
                    elif change['action'] == 'reorder':
                        display_changes.append({
                            'Time': change['timestamp'],
                            'Action': 'Reorder',
                            'Sub-theme': f"Items in {change['theme']}",
                            'From': '-',
                            'To': '-'
                        })
                
                changes_df = pd.DataFrame(display_changes)
                st.dataframe(changes_df, use_container_width=True, hide_index=True)
    else:
        st.info("💡 **Tip:** Use the drag & drop interface above to move sub-themes between the two selected categories!")
    
    # Summary statistics
    st.markdown("---")
    st.subheader("📈 Summary Statistics")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        total_moves = len(st.session_state.changes_log)
        st.metric("Total Changes Made", total_moves)
    
    with col2:
        if st.session_state.changes_log:
            themes_changed = len(set([change.get('from', change.get('theme', '')) for change in st.session_state.changes_log] + 
                                   [change.get('to', change.get('theme', '')) for change in st.session_state.changes_log]))
            st.metric("Themes Modified", themes_changed)
        else:
            st.metric("Themes Modified", 0)
    
    with col3:
        if st.session_state.modified_themes:
            largest_theme = max(st.session_state.modified_themes.items(), key=lambda x: len(x[1]))
            st.metric("Largest Theme", f"{largest_theme[0]} ({len(largest_theme[1])})")
        else:
            st.metric("Largest Theme", "No data")

def handle_two_container_change(new_containers, old_containers, left_theme, right_theme):
    """Handle changes when items are moved between the two containers"""
    themes = [left_theme, right_theme]
    
    # First, detect moves between containers
    left_old_items = set(old_containers[0]['items'])
    left_new_items = set(new_containers[0]['items'])
    right_old_items = set(old_containers[1]['items'])
    right_new_items = set(new_containers[1]['items'])
    
    # Items that moved from left to right
    moved_left_to_right = left_old_items - left_new_items
    # Items that moved from right to left  
    moved_right_to_left = right_old_items - right_new_items
    
    # Log cross-container moves
    for item_id in moved_left_to_right:
        if item_id in right_new_items:  # Confirm it actually moved to right
            parts = item_id.split('|||')
            if len(parts) >= 1:
                sub_theme_text = parts[0]
                change = {
                    'action': 'move',
                    'sub_theme': sub_theme_text,
                    'from': left_theme,
                    'to': right_theme,
                    'timestamp': pd.Timestamp.now().strftime("%H:%M:%S")
                }
                st.session_state.changes_log.append(change)
    
    for item_id in moved_right_to_left:
        if item_id in left_new_items:  # Confirm it actually moved to left
            parts = item_id.split('|||')
            if len(parts) >= 1:
                sub_theme_text = parts[0]
                change = {
                    'action': 'move',
                    'sub_theme': sub_theme_text,
                    'from': right_theme,
                    'to': left_theme,
                    'timestamp': pd.Timestamp.now().strftime("%H:%M:%S")
                }
                st.session_state.changes_log.append(change)
    
    # Update session state for both containers
    for i, (new_container, old_container) in enumerate(zip(new_containers, old_containers)):
        theme_name = themes[i]
        new_items = new_container['items']
        old_items = old_container['items']
        
        if new_items != old_items:
            # Update the theme data
            new_sub_themes = []
            for item_id in new_items:
                # Extract sub-theme text from item_id
                # Format: "sub_theme|||original_theme|||index"
                parts = item_id.split('|||')
                if len(parts) >= 1:
                    sub_theme_text = parts[0]
                    new_sub_themes.append(sub_theme_text)
            
            # Update the session state
            st.session_state.modified_themes[theme_name] = new_sub_themes
            
            # Check for reorders within the same theme (no cross-container moves)
            old_sub_theme_texts = []
            for item_id in old_items:
                parts = item_id.split('|||')
                if len(parts) >= 1:
                    old_sub_theme_texts.append(parts[0])
            
            # Only log reorder if it's just a reorder (same items, different order) and no cross-container moves
            if (set(new_sub_themes) == set(old_sub_theme_texts) and 
                new_sub_themes != old_sub_theme_texts and 
                len(new_sub_themes) == len(old_sub_theme_texts) and
                not moved_left_to_right and not moved_right_to_left):
                
                change = {
                    'action': 'reorder',
                    'theme': theme_name,
                    'old_order': old_sub_theme_texts,
                    'new_order': new_sub_themes,
                    'timestamp': pd.Timestamp.now().strftime("%H:%M:%S")
                }
                # Don't add duplicate reorder logs
                if not st.session_state.changes_log or st.session_state.changes_log[-1] != change:
                    st.session_state.changes_log.append(change)

def undo_change(change):
    """Undo a specific change"""
    if change['action'] == 'move':
        # Move item back
        if change['sub_theme'] in st.session_state.modified_themes[change['to']]:
            st.session_state.modified_themes[change['to']].remove(change['sub_theme'])
            st.session_state.modified_themes[change['from']].append(change['sub_theme'])
    elif change['action'] == 'reorder':
        # Restore old order
        st.session_state.modified_themes[change['theme']] = change['old_order'].copy()
    
    # Remove from changes log
    if change in st.session_state.changes_log:
        st.session_state.changes_log.remove(change)

def export_modified_themes():
    """Export the modified themes"""
    export_data = {
        'modified_themes': st.session_state.modified_themes,
        'changes_log': st.session_state.changes_log,
        'export_timestamp': pd.Timestamp.now().isoformat()
    }
    
    st.download_button(
        label="📥 Download JSON",
        data=json.dumps(export_data, indent=2, ensure_ascii=False),
        file_name=f"modified_themes_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.json",
        mime="application/json"
    )

def show_overview(themes_data):
    st.header("📊 Overview of Crime Themes")
    
    # Key metrics
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("Total Main Categories", len(themes_data))
    
    with col2:
        total_sub_themes = sum(len(sub_themes) for sub_themes in themes_data.values())
        st.metric("Total Sub-themes", total_sub_themes)
    
    with col3:
        avg_sub_themes = round(total_sub_themes / len(themes_data), 1)
        st.metric("Avg Sub-themes per Category", avg_sub_themes)
    
    st.markdown("---")
    
    # Theme categories overview
    st.subheader("Main Theme Categories")
    
    # Create a summary dataframe
    summary_data = []
    for theme, sub_themes in themes_data.items():
        summary_data.append({
            "Theme Category": theme,
            "Number of Sub-themes": len(sub_themes),
            "Example Sub-themes": ", ".join(sub_themes[:3]) + ("..." if len(sub_themes) > 3 else "")
        })
    
    df_summary = pd.DataFrame(summary_data)
    st.dataframe(df_summary, use_container_width=True, hide_index=True)
    
    # Visualization
    st.subheader("Distribution of Sub-themes by Category")
    
    fig = px.bar(
        df_summary, 
        x="Theme Category", 
        y="Number of Sub-themes",
        title="Number of Sub-themes per Main Category",
        color="Number of Sub-themes",
        color_continuous_scale="viridis"
    )
    fig.update_layout(xaxis_tickangle=45)
    st.plotly_chart(fig, use_container_width=True)

def show_theme_explorer(themes_data):
    st.header("🔎 Theme Explorer")
    
    # Theme selection
    selected_theme = st.selectbox(
        "Select a theme category to explore:",
        list(themes_data.keys())
    )
    
    if selected_theme:
        st.subheader(f"📂 {selected_theme}")
        
        sub_themes = themes_data[selected_theme]
        
        col1, col2 = st.columns([2, 1])
        
        with col1:
            st.write(f"**Number of sub-themes:** {len(sub_themes)}")
            
            # Display sub-themes as expandable sections
            with st.expander("View all sub-themes", expanded=True):
                for i, sub_theme in enumerate(sub_themes, 1):
                    st.write(f"{i}. {sub_theme}")
        
        with col2:
            # Word frequency analysis
            st.subheader("Word Analysis")
            
            # Extract words from sub-themes
            all_words = []
            for sub_theme in sub_themes:
                words = sub_theme.lower().replace(',', '').split()
                all_words.extend([word for word in words if len(word) > 3])
            
            word_counts = Counter(all_words)
            most_common = word_counts.most_common(10)
            
            if most_common:
                words_df = pd.DataFrame(most_common, columns=['Word', 'Frequency'])
                
                fig = px.bar(
                    words_df, 
                    x='Frequency', 
                    y='Word',
                    orientation='h',
                    title=f"Most Common Words in {selected_theme}",
                    color='Frequency',
                    color_continuous_scale="blues"
                )
                fig.update_layout(yaxis={'categoryorder':'total ascending'})
                st.plotly_chart(fig, use_container_width=True)

def show_statistics(themes_data):
    st.header("📈 Statistical Analysis")
    
    # Prepare data for analysis
    stats_data = []
    for theme, sub_themes in themes_data.items():
        stats_data.append({
            "Theme": theme,
            "Count": len(sub_themes)
        })
    
    df_stats = pd.DataFrame(stats_data)
    
    col1, col2 = st.columns(2)
    
    with col1:
        # Pie chart
        fig_pie = px.pie(
            df_stats, 
            values='Count', 
            names='Theme',
            title="Distribution of Sub-themes Across Categories"
        )
        fig_pie.update_traces(textposition='inside', textinfo='percent+label')
        st.plotly_chart(fig_pie, use_container_width=True)
    
    with col2:
        # Box plot for distribution analysis
        fig_box = go.Figure()
        fig_box.add_trace(go.Box(
            y=df_stats['Count'],
            name="Sub-themes Count",
            boxpoints='all',
            jitter=0.3,
            pointpos=-1.8
        ))
        fig_box.update_layout(
            title="Distribution of Sub-theme Counts",
            yaxis_title="Number of Sub-themes"
        )
        st.plotly_chart(fig_box, use_container_width=True)
    
    # Detailed statistics
    st.subheader("Detailed Statistics")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("Maximum Sub-themes", df_stats['Count'].max())
        max_theme = df_stats.loc[df_stats['Count'].idxmax(), 'Theme']
        st.caption(f"Category: {max_theme}")
    
    with col2:
        st.metric("Minimum Sub-themes", df_stats['Count'].min())
        min_theme = df_stats.loc[df_stats['Count'].idxmin(), 'Theme']
        st.caption(f"Category: {min_theme}")
    
    with col3:
        st.metric("Standard Deviation", round(df_stats['Count'].std(), 2))
        st.caption("Measure of variability")
    
    # Ranking table
    st.subheader("Theme Categories Ranked by Number of Sub-themes")
    df_ranked = df_stats.sort_values('Count', ascending=False).reset_index(drop=True)
    df_ranked.index += 1
    st.dataframe(df_ranked, use_container_width=True)

def show_search_filter(themes_data):
    st.header("🔍 Search & Filter")
    
    # Search functionality
    search_term = st.text_input("Search in themes and sub-themes:", placeholder="Enter keywords...")
    
    if search_term:
        st.subheader(f"Search Results for: '{search_term}'")
        
        results = []
        for main_theme, sub_themes in themes_data.items():
            # Search in main theme
            if search_term.lower() in main_theme.lower():
                results.append({
                    "Type": "Main Theme",
                    "Category": main_theme,
                    "Match": main_theme,
                    "Sub-themes Count": len(sub_themes)
                })
            
            # Search in sub-themes
            for sub_theme in sub_themes:
                if search_term.lower() in sub_theme.lower():
                    results.append({
                        "Type": "Sub-theme",
                        "Category": main_theme,
                        "Match": sub_theme,
                        "Sub-themes Count": len(sub_themes)
                    })
        
        if results:
            df_results = pd.DataFrame(results)
            st.dataframe(df_results, use_container_width=True, hide_index=True)
            st.info(f"Found {len(results)} matches")
        else:
            st.warning("No matches found. Try different keywords.")
    
    # Filter by category size
    st.markdown("---")
    st.subheader("Filter by Category Size")
    
    min_sub_themes = st.slider(
        "Minimum number of sub-themes:",
        min_value=1,
        max_value=max(len(sub_themes) for sub_themes in themes_data.values()),
        value=1
    )
    
    filtered_themes = {
        theme: sub_themes 
        for theme, sub_themes in themes_data.items() 
        if len(sub_themes) >= min_sub_themes
    }
    
    st.write(f"**Categories with {min_sub_themes}+ sub-themes:** {len(filtered_themes)}")
    
    for theme, sub_themes in filtered_themes.items():
        with st.expander(f"{theme} ({len(sub_themes)} sub-themes)"):
            for sub_theme in sub_themes:
                st.write(f"• {sub_theme}")

def show_case_browser(cases_data, themes_data):
    st.header("📋 Crime Case Browser")
    
    if not cases_data:
        st.warning("Crime cases data not available.")
        return
    
    # Theme filter
    st.subheader("Filter by Theme")
    theme_options = ["All themes"] + list(themes_data.keys())
    selected_theme_filter = st.selectbox("Select theme to filter cases:", theme_options)
    
    # Filter cases by theme
    filtered_cases = {}
    for case_id, case_data in cases_data.items():
        if selected_theme_filter == "All themes" or case_data.get('theme') == selected_theme_filter:
            filtered_cases[case_id] = case_data
    
    st.write(f"**Found {len(filtered_cases)} cases**")
    
    if filtered_cases:
        # Pagination
        cases_per_page = st.selectbox("Cases per page:", [5, 10, 20, 50], index=1)
        
        # Convert to list for pagination
        case_items = list(filtered_cases.items())
        total_pages = (len(case_items) - 1) // cases_per_page + 1
        
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            current_page = st.selectbox(
                f"Page (1-{total_pages}):",
                range(1, total_pages + 1)
            )
        
        # Get cases for current page
        start_idx = (current_page - 1) * cases_per_page
        end_idx = start_idx + cases_per_page
        page_cases = case_items[start_idx:end_idx]
        
        # Display cases
        for case_id, case_data in page_cases:
            with st.expander(f"Case {case_id} - {case_data.get('theme', 'No theme assigned')}"):
                col1, col2 = st.columns([2, 1])
                
                with col1:
                    st.write("**Crime Description:**")
                    description = case_data.get('plny_skutek_short', 'No description available')
                    # Truncate long descriptions
                    if len(description) > 500:
                        description = description[:500] + "..."
                    st.write(description)
                
                with col2:
                    st.write("**Case Details:**")
                    st.write(f"**AI Theme:** {case_data.get('theme', 'N/A')}")
                    st.write(f"**Human Category:** {case_data.get('Varianta_EN', 'N/A')}")
                    st.write(f"**Initial Code:** {case_data.get('initial_code', 'N/A')}")
                    if 'tokens' in case_data:
                        st.write(f"**Text Length:** {case_data['tokens']} tokens")

def show_ai_human_comparison(cases_data, themes_data):
    st.header("🤖👤 AI vs Human Theme Comparison")
    
    if not cases_data:
        st.warning("Crime cases data not available.")
        return
    
    # Prepare comparison data
    comparison_data = []
    for case_id, case_data in cases_data.items():
        if 'theme' in case_data and 'Varianta_EN' in case_data:
            comparison_data.append({
                'Case_ID': case_id,
                'AI_Theme': case_data['theme'],
                'Human_Theme': case_data['Varianta_EN'],
                'Initial_Code': case_data.get('initial_code', ''),
                'Description': case_data.get('plny_skutek_short', '')[:200] + "..."
            })
    
    df_comparison = pd.DataFrame(comparison_data)
    
    if df_comparison.empty:
        st.warning("No cases with both AI and human themes found.")
        return
    
    # Overall statistics
    st.subheader("📊 Comparison Overview")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("Total Cases with Both Themes", len(df_comparison))
    
    with col2:
        ai_themes_count = df_comparison['AI_Theme'].nunique()
        st.metric("Unique AI Themes", ai_themes_count)
    
    with col3:
        human_themes_count = df_comparison['Human_Theme'].nunique()
        st.metric("Unique Human Categories", human_themes_count)
    
    # Theme distribution comparison
    st.subheader("📈 Theme Distribution Comparison")
    
    col1, col2 = st.columns(2)
    
    with col1:
        ai_theme_counts = df_comparison['AI_Theme'].value_counts().head(10)
        fig_ai = px.bar(
            x=ai_theme_counts.values,
            y=ai_theme_counts.index,
            orientation='h',
            title="Top 10 AI Themes",
            labels={'x': 'Count', 'y': 'AI Theme'}
        )
        fig_ai.update_layout(yaxis={'categoryorder':'total ascending'})
        st.plotly_chart(fig_ai, use_container_width=True)
    
    with col2:
        human_theme_counts = df_comparison['Human_Theme'].value_counts().head(10)
        fig_human = px.bar(
            x=human_theme_counts.values,
            y=human_theme_counts.index,
            orientation='h',
            title="Top 10 Human Categories",
            labels={'x': 'Count', 'y': 'Human Theme'}
        )
        fig_human.update_layout(yaxis={'categoryorder':'total ascending'})
        st.plotly_chart(fig_human, use_container_width=True)
    
    # Agreement analysis
    st.subheader("🎯 Agreement Analysis")
    
    # Calculate exact matches (this might be rare due to different vocabularies)
    exact_matches = (df_comparison['AI_Theme'] == df_comparison['Human_Theme']).sum()
    agreement_rate = (exact_matches / len(df_comparison)) * 100
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.metric("Exact Theme Matches", f"{exact_matches} ({agreement_rate:.1f}%)")
    
    with col2:
        # Show most common AI-Human theme pairs
        theme_pairs = df_comparison.groupby(['AI_Theme', 'Human_Theme']).size().reset_index(name='Count')
        theme_pairs = theme_pairs.sort_values('Count', ascending=False).head(10)
        st.write("**Most Common AI-Human Theme Pairs:**")
        for _, row in theme_pairs.iterrows():
            st.write(f"• AI: {row['AI_Theme']} ↔ Human: {row['Human_Theme']} ({row['Count']} cases)")
    
    # Detailed comparison table
    st.subheader("🔍 Detailed Comparison")
    
    # Theme pair filter
    unique_ai_themes = ['All'] + sorted(df_comparison['AI_Theme'].unique())
    selected_ai_theme = st.selectbox("Filter by AI Theme:", unique_ai_themes)
    
    if selected_ai_theme != 'All':
        filtered_df = df_comparison[df_comparison['AI_Theme'] == selected_ai_theme]
    else:
        filtered_df = df_comparison
    
    # Display filtered results
    display_columns = ['Case_ID', 'AI_Theme', 'Human_Theme', 'Description']
    st.dataframe(
        filtered_df[display_columns].head(50),  # Limit to 50 for performance
        use_container_width=True,
        hide_index=True
    )
    
    if len(filtered_df) > 50:
        st.info(f"Showing first 50 of {len(filtered_df)} cases. Use filters to narrow down results.")

if __name__ == "__main__":
    main() 