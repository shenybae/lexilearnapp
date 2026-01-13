import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (classification_report, confusion_matrix, accuracy_score, 
                             f1_score, recall_score, precision_score)
from sklearn.metrics import roc_curve, auc, precision_recall_curve, RocCurveDisplay, PrecisionRecallDisplay
import matplotlib
matplotlib.use("Agg")  # Use non-GUI backend to avoid Tkinter crash
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
warnings.filterwarnings('ignore')

# ========================================
# 1. LOAD AND PREPARE DATA
# ========================================
def load_data(filepath='dyslexia_focus_areas_20000.csv'):
    """Load the dyslexia focus area dataset"""
    df = pd.read_csv(filepath)
    print("="*70)
    print("DATASET LOADED")
    print("="*70)
    print(f"Total samples: {df.shape[0]}")
    print(f"Total features: {df.shape[1]}")
    print(f"\nClass Distribution:")
    print(df['difficulty_level'].value_counts())
    print(f"\nClass Percentages:")
    print(df['difficulty_level'].value_counts(normalize=True) * 100)
    return df


def prepare_data(df):
    """Prepare features and target for training"""
    feature_columns = [
        'age',
        'reading_speed', 'reading_accuracy', 'reading_comprehension',
        'writing_speed', 'writing_quality', 'grammar_sentence',
        'phonetic_spelling', 'irregular_word_spelling', 'spelling_accuracy'
    ]
    
    X = df[feature_columns].values
    y = df['difficulty_level'].values

    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    
    print("\n" + "="*70)
    print("DATA PREPARATION")
    print("="*70)
    print(f"Features: {feature_columns}")
    print(f"\nTarget classes: {le.classes_}")
    print(f"Class encoding: {dict(zip(le.classes_, range(len(le.classes_))))}")
    
    return X, y_encoded, le, feature_columns


def split_and_scale_data(X, y, test_size=0.2, random_state=42):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )
    
    print("\n" + "="*70)
    print("TRAIN/TEST SPLIT (80/20)")
    print("="*70)
    print(f"Training samples: {X_train.shape[0]} ({X_train.shape[0]/len(X)*100:.1f}%)")
    print(f"Test samples: {X_test.shape[0]} ({X_test.shape[0]/len(X)*100:.1f}%)")
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    return X_train_scaled, X_test_scaled, y_train, y_test, scaler

# ========================================
# 2. TRAIN 5 ALGORITHMS WITH 5-FOLD CROSS-VALIDATION
# ========================================
def train_models(X_train, y_train):
    
    models = {
        'Random Forest': RandomForestClassifier(
            n_estimators=150,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            max_features='sqrt',
            random_state=42,
            class_weight='balanced_subsample',
            n_jobs=-1
        ),
        'SVM': SVC(
            kernel='rbf',
            C=1.5,
            gamma='scale',
            probability=True,
            random_state=42,
            class_weight='balanced'
        ),
        'Logistic Regression': LogisticRegression(
            max_iter=2000,
            C=1.2,
            solver='lbfgs',
            multi_class='multinomial',
            random_state=42,
            class_weight='balanced'
        ),
        'Gradient Boosting': GradientBoostingClassifier(
            n_estimators=150,
            learning_rate=0.08,
            max_depth=5,
            min_samples_split=8,
            min_samples_leaf=3,
            subsample=0.85,
            random_state=42
        ),
        'K-Nearest Neighbors': KNeighborsClassifier(
            n_neighbors=7,
            weights='distance',
            metric='minkowski',
            p=2
        )
    }
    
    trained_models = {}
    
    print("\n" + "="*70)
    print("TRAINING 5 ALGORITHMS WITH 5-FOLD CROSS-VALIDATION")
    print("="*70)
    
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    
    for name, model in models.items():
        print(f"\n{'='*70}")
        print(f"Training: {name}")
        print(f"{'='*70}")
        
        # Train model
        model.fit(X_train, y_train)
        
        # 5-Fold CV
        cv_scores = cross_val_score(model, X_train, y_train, cv=skf, scoring='accuracy')
        cv_f1 = cross_val_score(model, X_train, y_train, cv=skf, scoring='f1_weighted')
        
        print(f"5-Fold CV Accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std()*2:.4f})")
        print(f"5-Fold CV F1-Score: {cv_f1.mean():.4f} (+/- {cv_f1.std()*2:.4f})")
        
        train_score = model.score(X_train, y_train)
        print(f"Training Accuracy: {train_score:.4f}")
        
        if train_score - cv_scores.mean() > 0.05:
            print("⚠️  Warning: Possible overfitting detected (train >> CV)")
        elif train_score - cv_scores.mean() < -0.05:
            print("⚠️  Warning: Possible underfitting detected (train << CV)")
        else:
            print("✓ Good fit: Training and CV scores are balanced")
        
        trained_models[name] = model
    
    return trained_models

def evaluate_models(models, X_test, y_test, label_encoder):
    """Evaluate all models with Accuracy, F1, Recall, Precision"""
    results = {}
    
    print("\n" + "="*70)
    print("MODEL EVALUATION ON TEST SET")
    print("="*70)
    
    for name, model in models.items():
        print(f"\n{'='*70}")
        print(f"{name}")
        print(f"{'='*70}")
        
        # Predictions
        y_pred = model.predict(X_test)
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        f1_weighted = f1_score(y_test, y_pred, average='weighted')
        recall_weighted = recall_score(y_test, y_pred, average='weighted')
        precision_weighted = precision_score(y_test, y_pred, average='weighted')
        
        print(f"Accuracy:  {accuracy:.4f}")
        print(f"F1-Score:  {f1_weighted:.4f}")
        print(f"Recall:    {recall_weighted:.4f}")
        print(f"Precision: {precision_weighted:.4f}")
        
        # Detailed classification report
        print("\nDetailed Classification Report:")
        print(classification_report(y_test, y_pred, 
                                    target_names=label_encoder.classes_,
                                    digits=4,
                                    zero_division=0))
        
        # Store results
        results[name] = {
            'accuracy': accuracy,
            'f1_score': f1_weighted,
            'recall': recall_weighted,
            'precision': precision_weighted,
            'predictions': y_pred,
            'confusion_matrix': confusion_matrix(y_test, y_pred)
        }
    
    return results

# ========================================
# 4. VISUALIZATIONS
# ========================================

def plot_metrics_comparison(results):
    """Compare Accuracy, F1, Recall, Precision across models"""
    models = list(results.keys())
    metrics = ['accuracy', 'f1_score', 'recall', 'precision']
    metric_names = ['Accuracy', 'F1-Score', 'Recall', 'Precision']
    
    fig, axes = plt.subplots(2, 2, figsize=(15, 12))
    axes = axes.flatten()
    
    colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336']
    
    for idx, (metric, metric_name) in enumerate(zip(metrics, metric_names)):
        scores = [results[model][metric] for model in models]
        
        bars = axes[idx].bar(models, scores, color=colors)
        axes[idx].set_ylabel(metric_name, fontsize=12, fontweight='bold')
        axes[idx].set_title(f'{metric_name} Comparison', fontsize=14, fontweight='bold')
        axes[idx].set_ylim([0.8, 1.0])  # Focus on 80-100% range
        axes[idx].tick_params(axis='x', rotation=45)
        axes[idx].grid(axis='y', alpha=0.3)
        
        # Add value labels
        for bar in bars:
            height = bar.get_height()
            axes[idx].text(bar.get_x() + bar.get_width()/2., height,
                          f'{height:.4f}',
                          ha='center', va='bottom', fontsize=10, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig('metrics_comparison.png', dpi=300, bbox_inches='tight')
    print("\n✓ Saved: metrics_comparison.png")
    plt.show()

def plot_confusion_matrices(results, label_encoder):
    """Plot confusion matrices for all 5 models"""
    fig, axes = plt.subplots(2, 3, figsize=(20, 13))
    axes = axes.flatten()
    
    for idx, (name, result) in enumerate(results.items()):
        cm = result['confusion_matrix']
        
        # Calculate percentages
        cm_percent = cm.astype('float') / cm.sum(axis=1)[:, np.newaxis] * 100
        
        # Create annotations with counts and percentages
        annotations = np.array([[f"{count}\n({percent:.1f}%)" 
                                for count, percent in zip(row_counts, row_percents)]
                               for row_counts, row_percents in zip(cm, cm_percent)])
        
        sns.heatmap(cm, annot=annotations, fmt='', cmap='Blues',
                   xticklabels=label_encoder.classes_,
                   yticklabels=label_encoder.classes_,
                   ax=axes[idx],
                   cbar_kws={'label': 'Count'},
                   linewidths=1,
                   linecolor='gray')
        
        axes[idx].set_title(f'{name}\nAcc: {result["accuracy"]:.4f} | F1: {result["f1_score"]:.4f}',
                           fontweight='bold', fontsize=11)
        axes[idx].set_ylabel('True Label', fontweight='bold')
        axes[idx].set_xlabel('Predicted Label', fontweight='bold')
    
    # Hide extra subplot
    axes[-1].axis('off')
    
    plt.suptitle('Confusion Matrices - All 5 Algorithms', 
                fontsize=16, fontweight='bold', y=0.995)
    plt.tight_layout()
    plt.savefig('confusion_matrices_all.png', dpi=300, bbox_inches='tight')
    print("✓ Saved: confusion_matrices_all.png")
    plt.show()

def plot_class_performance(results, label_encoder):
    """Plot per-class performance for best model"""
    # Find best model
    best_model_name = max(results, key=lambda x: results[x]['f1_score'])
    best_result = results[best_model_name]
    
    cm = best_result['confusion_matrix']
    classes = label_encoder.classes_
    
    # Calculate per-class metrics
    per_class_accuracy = []
    per_class_recall = []
    per_class_precision = []
    
    for i in range(len(classes)):
        # Recall (Sensitivity)
        recall = cm[i, i] / cm[i, :].sum() if cm[i, :].sum() > 0 else 0
        # Precision
        precision = cm[i, i] / cm[:, i].sum() if cm[:, i].sum() > 0 else 0
        
        per_class_recall.append(recall)
        per_class_precision.append(precision)
    
    # Plot
    x = np.arange(len(classes))
    width = 0.35
    
    fig, ax = plt.subplots(figsize=(12, 7))
    bars1 = ax.bar(x - width/2, per_class_recall, width, label='Recall', color='#2196F3')
    bars2 = ax.bar(x + width/2, per_class_precision, width, label='Precision', color='#FF9800')
    
    ax.set_xlabel('Difficulty Level', fontsize=12, fontweight='bold')
    ax.set_ylabel('Score', fontsize=12, fontweight='bold')
    ax.set_title(f'Per-Class Performance: {best_model_name}', fontsize=14, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels(classes)
    ax.legend(fontsize=11)
    ax.set_ylim([0, 1.1])
    ax.grid(axis='y', alpha=0.3)
    
    # Add value labels
    for bars in [bars1, bars2]:
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{height:.3f}',
                   ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig('per_class_performance.png', dpi=300, bbox_inches='tight')
    print("✓ Saved: per_class_performance.png")
    plt.show()

# ========================================
# 5. SAVE BEST MODEL
# ========================================

def save_best_model(models, results, scaler, label_encoder):
    """Save the best performing model"""
    import pickle
    
    # Find best model based on F1-score (better for imbalanced data)
    best_model_name = max(results, key=lambda x: results[x]['f1_score'])
    best_model = models[best_model_name]
    best_metrics = results[best_model_name]
    
    print("\n" + "="*70)
    print("BEST MODEL SELECTION")
    print("="*70)
    print(f"🏆 Best Model: {best_model_name}")
    print(f"   Accuracy:  {best_metrics['accuracy']:.4f}")
    print(f"   F1-Score:  {best_metrics['f1_score']:.4f}")
    print(f"   Recall:    {best_metrics['recall']:.4f}")
    print(f"   Precision: {best_metrics['precision']:.4f}")
    
    # Save model
    filename = 'best_dyslexia_focus_model'
    with open(f'{filename}.pkl', 'wb') as f:
        pickle.dump(best_model, f)
    with open(f'{filename}_scaler.pkl', 'wb') as f:
        pickle.dump(scaler, f)
    with open(f'{filename}_labels.pkl', 'wb') as f:
        pickle.dump(label_encoder, f)
    
    print(f"\n✓ Model saved as '{filename}.pkl'")
    print(f"✓ Scaler saved as '{filename}_scaler.pkl'")
    print(f"✓ Label encoder saved as '{filename}_labels.pkl'")
    
    return best_model_name, best_model

# ========================================
# 6. PREDICT FOCUS AREAS
# ========================================

def predict_with_focus_areas(model, scaler, label_encoder, df):
    """Demonstrate prediction with focus area identification"""
    print("\n" + "="*70)
    print("EXAMPLE PREDICTION WITH FOCUS AREAS")
    print("="*70)
    
    # Get a random sample from test data
    sample = df.sample(1).iloc[0]
    
    print(f"\nStudent Profile:")
    print(f"  Age: {sample['age']} years")
    print(f"\n📖 Reading Scores:")
    print(f"  Speed: {sample['reading_speed']}")
    print(f"  Accuracy: {sample['reading_accuracy']}")
    print(f"  Comprehension: {sample['reading_comprehension']}")
    print(f"  Average: {sample['reading_avg']}")
    print(f"\n✍️  Writing Scores:")
    print(f"  Speed: {sample['writing_speed']}")
    print(f"  Quality: {sample['writing_quality']}")
    print(f"  Grammar: {sample['grammar_sentence']}")
    print(f"  Average: {sample['writing_avg']}")
    print(f"\n🔤 Spelling Scores:")
    print(f"  Phonetic: {sample['phonetic_spelling']}")
    print(f"  Irregular: {sample['irregular_word_spelling']}")
    print(f"  Accuracy: {sample['spelling_accuracy']}")
    print(f"  Average: {sample['spelling_avg']}")
    
    # Prepare features
    features = [
        sample['age'],
        sample['reading_speed'], sample['reading_accuracy'], sample['reading_comprehension'],
        sample['writing_speed'], sample['writing_quality'], sample['grammar_sentence'],
        sample['phonetic_spelling'], sample['irregular_word_spelling'], sample['spelling_accuracy']
    ]
    
    X_new = scaler.transform([features])
    
    # Predict
    prediction = model.predict(X_new)[0]
    predicted_difficulty = label_encoder.inverse_transform([prediction])[0]
    
    if hasattr(model, 'predict_proba'):
        probabilities = model.predict_proba(X_new)[0]
        print("\n📊 Prediction Probabilities:")
        for i, class_name in enumerate(label_encoder.classes_):
            print(f"  {class_name}: {probabilities[i]*100:.2f}%")
    
    print(f"\n{'='*70}")
    print(f"🎯 RESULTS:")
    print(f"{'='*70}")
    print(f"Predicted Difficulty: {predicted_difficulty}")
    print(f"Actual Difficulty: {sample['difficulty_level']}")
    print(f"\n📌 Focus Areas (Weakest to Strongest):")
    print(f"  1️⃣  PRIMARY FOCUS: {sample['primary_focus']} ({sample[sample['primary_focus'].lower() + '_avg']}/100)")
    print(f"  2️⃣  Secondary Focus: {sample['secondary_focus']} ({sample[sample['secondary_focus'].lower() + '_avg']}/100)")
    print(f"  3️⃣  Tertiary Focus: {sample['tertiary_focus']} ({sample[sample['tertiary_focus'].lower() + '_avg']}/100)")

# ========================================
# 7. MAIN EXECUTION
# ========================================
# ========================================
# 4. ADDITIONAL VISUALIZATIONS
# ========================================

def plot_dataset_distribution(df):
    """Visualize dataset distribution by difficulty level and age."""
    plt.figure(figsize=(12, 5))
    
    # Class distribution
    plt.subplot(1, 2, 1)
    sns.countplot(data=df, x='difficulty_level', palette='Set2', order=df['difficulty_level'].value_counts().index)
    plt.title("Dataset Distribution by Difficulty Level", fontsize=14, fontweight='bold')
    plt.ylabel("Number of Samples")
    plt.xlabel("Difficulty Level")
    
    # Age distribution
    plt.subplot(1, 2, 2)
    sns.histplot(df['age'], bins=10, kde=True, color='skyblue')
    plt.title("Age Distribution of Students", fontsize=14, fontweight='bold')
    plt.xlabel("Age (years)")
    plt.ylabel("Count")
    
    plt.tight_layout()
    plt.savefig("dataset_distribution.png", dpi=300)
    print("✓ Saved: dataset_distribution.png")
    plt.show()


def plot_feature_distributions(df, features):
    """Plot histograms for each feature to see distributions and potential outliers."""
    n_features = len(features)
    n_cols = 3
    n_rows = int(np.ceil(n_features / n_cols))
    
    plt.figure(figsize=(15, 5 * n_rows))
    
    for idx, feature in enumerate(features):
        plt.subplot(n_rows, n_cols, idx + 1)
        sns.histplot(df[feature], kde=True, bins=20, color='coral')
        plt.title(f"Distribution of {feature}", fontsize=12, fontweight='bold')
        plt.xlabel(feature)
    
    plt.tight_layout()
    plt.savefig("feature_distributions.png", dpi=300)
    print("✓ Saved: feature_distributions.png")
    plt.show()


def plot_model_confidence_curve(model, X_test, y_test, label_encoder):
    """Plot predicted probability distribution for each class."""
    if not hasattr(model, "predict_proba"):
        print("⚠️ Confidence curves require models with predict_proba() method")
        return
    
    y_proba = model.predict_proba(X_test)
    classes = label_encoder.classes_
    
    plt.figure(figsize=(12, 6))
    
    for idx, class_name in enumerate(classes):
        sns.kdeplot(y_proba[:, idx], label=f"{class_name} probability", fill=True)
    
    plt.title("Predicted Probability Distributions per Class", fontsize=14, fontweight='bold')
    plt.xlabel("Predicted Probability")
    plt.ylabel("Density")
    plt.legend()
    plt.savefig("model_confidence_curves.png", dpi=300)
    print("✓ Saved: model_confidence_curves.png")
    plt.show()


def plot_roc_auc_multiclass(model, X_test, y_test, label_encoder):
    """Plot ROC curves for multi-class classification."""
    from sklearn.preprocessing import label_binarize
    
    if not hasattr(model, "predict_proba"):
        print("⚠️ ROC-AUC requires models with predict_proba() method")
        return
    
    classes = label_encoder.classes_
    y_test_bin = label_binarize(y_test, classes=np.arange(len(classes)))
    y_score = model.predict_proba(X_test)
    
    plt.figure(figsize=(10, 8))
    
    for i in range(len(classes)):
        fpr, tpr, _ = roc_curve(y_test_bin[:, i], y_score[:, i])
        roc_auc = auc(fpr, tpr)
        plt.plot(fpr, tpr, label=f"{classes[i]} (AUC = {roc_auc:.3f})")
    
    plt.plot([0, 1], [0, 1], 'k--')
    plt.title("Multi-Class ROC Curves", fontsize=14, fontweight='bold')
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.legend(loc="lower right")
    plt.grid(True)
    plt.savefig("roc_auc_multiclass.png", dpi=300)
    print("✓ Saved: roc_auc_multiclass.png")
    plt.show()


def plot_precision_recall_multiclass(model, X_test, y_test, label_encoder):
    """Plot Precision-Recall curves for multi-class classification."""
    from sklearn.preprocessing import label_binarize
    
    if not hasattr(model, "predict_proba"):
        print("⚠️ Precision-Recall curves require models with predict_proba() method")
        return
    
    classes = label_encoder.classes_
    y_test_bin = label_binarize(y_test, classes=np.arange(len(classes)))
    y_score = model.predict_proba(X_test)
    
    plt.figure(figsize=(10, 8))
    
    for i, class_name in enumerate(classes):
        precision, recall, _ = precision_recall_curve(y_test_bin[:, i], y_score[:, i])
        plt.plot(recall, precision, label=f"{class_name}")
    
    plt.title("Multi-Class Precision-Recall Curves", fontsize=14, fontweight='bold')
    plt.xlabel("Recall")
    plt.ylabel("Precision")
    plt.legend(loc="lower left")
    plt.grid(True)
    plt.savefig("precision_recall_multiclass.png", dpi=300)
    print("✓ Saved: precision_recall_multiclass.png")
    plt.show()


def plot_feature_importance(model, feature_names):
    """Plot feature importance for tree-based models (Random Forest or Gradient Boosting)."""
    if not hasattr(model, "feature_importances_"):
        print("⚠️ Feature importance only available for tree-based models")
        return
    
    importance = model.feature_importances_
    indices = np.argsort(importance)[::-1]  # Sort descending
    
    plt.figure(figsize=(12, 6))
    sns.barplot(x=importance[indices], y=[feature_names[i] for i in indices], palette='viridis')
    plt.title("Feature Importance", fontsize=14, fontweight='bold')
    plt.xlabel("Importance Score")
    plt.ylabel("Feature")
    plt.tight_layout()
    plt.savefig("feature_importance.png", dpi=300)
    print("✓ Saved: feature_importance.png")
    plt.show()


# ========================================
# MAIN EXECUTION
# ========================================

def main():
    print("\n" + "="*70)
    print("DYSLEXIA FOCUS AREA ML TRAINER")
    print("="*70)
    
    # Load data
    df = load_data('dyslexia_focus_areas_20000.csv')
    
    # Prepare data
    X, y, label_encoder, feature_names = prepare_data(df)
    
    
    # Split and scale (80/20)
    X_train, X_test, y_train, y_test, scaler = split_and_scale_data(X, y)
    
    # Train 5 models
    trained_models = train_models(X_train, y_train)
    
    # Evaluate models
    results = evaluate_models(trained_models, X_test, y_test, label_encoder)
    
    # Standard visualizations
    plot_metrics_comparison(results)
    plot_confusion_matrices(results, label_encoder)
    plot_class_performance(results, label_encoder)
    
    # Additional visualizations
    plot_dataset_distribution(df)
    plot_feature_distributions(df, feature_names)
    
    best_model_name = max(results, key=lambda x: results[x]['f1_score'])
    best_model = trained_models[best_model_name]
    
    plot_model_confidence_curve(best_model, X_test, y_test, label_encoder)
    plot_roc_auc_multiclass(best_model, X_test, y_test, label_encoder)
    plot_precision_recall_multiclass(best_model, X_test, y_test, label_encoder)
    plot_feature_importance(best_model, feature_names)
    
    # Save best model
    best_model_name, best_model = save_best_model(trained_models, results, scaler, label_encoder)
    
    # Example prediction
    predict_with_focus_areas(best_model, scaler, label_encoder, df)
    
    print("\n" + "="*70)
    print("✅ TRAINING COMPLETE!")
    print("="*70)
    print("\nGenerated files:")
    print("  • metrics_comparison.png")
    print("  • confusion_matrices_all.png")
    print("  • per_class_performance.png")
    print("  • dataset_distribution.png")
    print("  • feature_distributions.png")
    print("  • model_confidence_curves.png")
    print("  • roc_auc_multiclass.png")
    print("  • precision_recall_multiclass.png")
    print("  • feature_importance.png")
    print("  • best_dyslexia_focus_model.pkl")
    print("  • best_dyslexia_focus_model_scaler.pkl")
    print("  • best_dyslexia_focus_model_labels.pkl")
    print("\n" + "="*70)

if __name__ == "__main__":
    main()